import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';

const isApply = process.argv.includes('--apply');
const toMysqlDateTime = (date = new Date()) => date.toISOString().slice(0, 19).replace('T', ' ');

const fixes = {
  'cdb0add0-0a86-4117-b5c0-be3f0b1e1d43': {
    answer: `MySQL 主库故障的处理取决于实际高可用架构，不能使用 Redis Sentinel。

1. 先确认故障范围：检查主机、mysqld、磁盘、网络、复制延迟和事务一致性，避免把网络抖动误判为主库故障。
2. 如果使用 InnoDB Cluster / Group Replication、Orchestrator、MHA 等方案，按预案选出数据最完整且复制正常的副本并完成提升；没有自动化方案时应人工确认 GTID/位点后再切换。
3. 将代理或应用连接切到新主库，并验证写入、读取、复制、连接池和关键业务。
4. 隔离旧主库，防止双写；修复后以新主库为基准重建为副本，不能直接让旧主库重新提供写服务。
5. 复盘 RPO/RTO、告警、自动切换条件、备份恢复和定期演练结果。

回答时应结合真实使用的复制模式、代理组件和切换流程。`,
    tags: ['mysql', '高可用', '主从复制', '故障切换', '面试题'],
  },
  '43431030-9ba1-4f32-aef7-9d95b0a548a0': {
    answer: `iptables 是 Linux 用户态规则配置工具，规则由内核 netfilter 数据路径执行，常用于包过滤、NAT、转发和报文修改。

常见四表：
1. filter：包过滤，常见内建链为 INPUT、FORWARD、OUTPUT。
2. nat：地址转换，常见链为 PREROUTING、INPUT、OUTPUT、POSTROUTING；只处理连接中的首包并由连接跟踪复用结果。
3. mangle：修改报文标记、TTL 等，常见链覆盖 PREROUTING、INPUT、FORWARD、OUTPUT、POSTROUTING。
4. raw：在连接跟踪之前处理报文，常见内建链为 PREROUTING、OUTPUT。

常说的五链是 INPUT、OUTPUT、FORWARD、PREROUTING、POSTROUTING。排障时还要结合数据包方向、路由决策、conntrack、规则顺序和计数器，常用命令有 \`iptables -t <table> -L -n -v --line-numbers\`。`,
    tags: ['linux', 'iptables', 'netfilter', '防火墙', '网络'],
  },
  '1cc9c4d7-e30a-4c8f-8630-76dc6095b222': {
    answer: `ConfigMap 用于保存非敏感配置，例如配置文件片段、环境变量和命令参数；Secret 用于保存密码、令牌、证书等敏感数据。二者都可以通过环境变量或卷挂载给 Pod。

需要注意：Secret 的值通常只是 base64 编码，并不等于加密。Kubernetes 默认不会自动加密 etcd 中的 Secret 数据。生产环境应显式启用静态数据加密或 KMS、限制 RBAC 权限、避免把 Secret 写入镜像和日志，并根据需要使用外部密钥/Secret 管理系统和轮换机制。`,
    tags: ['kubernetes', 'secret', 'configmap', '安全'],
  },
  'a270fa6a-074a-4489-b663-24c0e428e83c': {
    answer: `Pod 的生命周期不能简单理解为每个 Pod 都按固定顺序经过所有状态。常见 Pod Phase：

- Pending：Pod 已被接受，但尚未完成调度或至少一个容器尚未准备好运行。
- Running：Pod 已绑定到节点，至少一个容器正在运行、启动中或重启中。
- Succeeded：所有容器都成功终止，且不会再重启。
- Failed：所有容器已终止，且至少一个容器失败终止。
- Unknown：控制面无法获取 Pod 状态，常见于节点通信异常，不是正常终止阶段。

\`CrashLoopBackOff\`、\`ImagePullBackOff\` 是 kubectl 展示的容器等待原因，不是 Pod Phase。排障应结合 \`kubectl describe pod\`、Events、容器状态、探针、退出码和日志。`,
    tags: ['kubernetes', 'pod', '生命周期', '故障排查'],
  },
  '87ec922a-630b-4aef-9b98-705b3cb2ed07': {
    answer: `如果题目限定 Underlay（无隧道路由）方式，跨主机 Pod 通信主要依赖：

1. CNI/IPAM 为 Pod 分配地址并配置 veth、路由和必要的策略。
2. 每个节点知道其他节点 Pod CIDR 的下一跳，可通过 BGP、静态路由或云路由表传播。
3. 底层网络能够路由 Pod 网段，节点开启必要的 IP 转发，并正确配置防火墙、反向路径过滤和 NetworkPolicy。
4. 数据包保持原始 Pod IP，不经过 VXLAN/IPIP 隧道封装；是否需要 SNAT 取决于目的网络及路由可达性。

VXLAN、IP-in-IP 属于 Overlay/隧道方案，可作为对比，但不应当作 Underlay 的组成部分。`,
    tags: ['kubernetes', 'pod网络', 'underlay', 'bgp', '路由'],
  },
  '352fc77a-9118-4ddf-8889-b53c001005ae': {
    answer: `OpenTelemetry 整体由规范（Specification）、API、SDK、语义约定、自动/手动埋点、Collector 以及各类导出器等部分组成。

- API：应用代码创建 Trace、Metric、Log 遥测信号的稳定接口。
- SDK：实现采样、处理、聚合和导出。
- Instrumentation：通过自动探针或手动代码生成遥测数据。
- Collector：以厂商中立方式接收、处理并导出遥测数据。
- Semantic Conventions：统一属性和资源命名。

如果题目问的是 Collector 流水线，其核心组件应回答 Receiver、Processor、Exporter，并可补充 Connector 和 Extension。题干需要明确是在问 OpenTelemetry 整体还是 Collector。`,
    tags: ['opentelemetry', '可观测性', 'collector', 'tracing'],
  },
  '2541afaf-eeb2-46b4-bad3-2109b310dc00': {
    answer: `Pod 显示 Pending 时，应先看 \`kubectl describe pod <pod> -n <namespace>\` 的 Events，再按阶段判断：

1. 调度失败：CPU/内存不足、污点未容忍、亲和性/节点选择器不满足、端口或拓扑约束冲突。
2. 存储未就绪：PVC 未绑定、CSI 挂载失败或卷拓扑不满足。
3. Pod sandbox/CNI：网络插件异常、地址耗尽、创建 sandbox 失败。
4. 镜像与容器准备：镜像拉取失败、鉴权失败等情况下 Pod Phase 可能仍是 Pending，但要查看具体容器 Waiting 原因。
5. 节点问题：节点 NotReady、kubelet 或容器运行时异常。

启动命令执行后反复退出通常表现为容器 \`CrashLoopBackOff\`，不应与“无法调度的 Pending”混为一谈。`,
    tags: ['kubernetes', 'pod', 'pending', '故障排查'],
  },
  '1523119b-b355-4d15-9c61-5c851bfe3328': {
    answer: `不能笼统地说所有中间件都必须部署奇数个节点。奇数成员的收益主要适用于依赖多数派投票的成员集群，例如 etcd、ZooKeeper、Raft Controller Quorum 等。

投票集群通常可容忍 \`floor((n-1)/2)\` 个成员故障。3 个成员可容忍 1 个，4 个成员通常仍只能容忍 1 个，因此第 4 个投票成员增加成本却不增加容错数；5 个可容忍 2 个。

但 Kafka Broker、Redis 数据分片、普通工作节点或无投票语义的副本数量，应根据副本因子、容量、分区、故障域和读写模型设计，不能直接套用“奇数原则”。奇数节点也只是形成多数派的条件之一，并不能单独避免脑裂。`,
    tags: ['分布式系统', 'quorum', '高可用', '集群'],
  },
  'cab86c24-38f0-4537-bfa7-ec3a583c3f40': {
    answer: `我们的目标通常是尽量不停机升级，但不能无条件承诺零中断。

实现条件包括：至少两个可用副本、正确的 readiness/startupProbe、合理的 maxSurge/maxUnavailable、PodDisruptionBudget、优雅终止、会话和连接排空、足够的集群容量，以及新旧版本 API 和数据库 Schema 兼容。

常用策略有滚动更新、蓝绿发布和灰度发布。发布前要完成备份与预演；发布中观察错误率、延迟、资源和业务指标；异常时回滚应用。数据库变更应使用向前/向后兼容的 expand-and-contract 方式，并准备独立的数据恢复方案。回答时应结合真实发布架构和停机窗口要求。`,
    tags: ['发布策略', '滚动更新', '高可用', 'kubernetes'],
  },
  'a5e5c930-52a8-4246-87d2-4ad8fca3000b': {
    answer: `版本更新涉及数据库 Schema 时，不应把数据库理解为随应用节点“逐台更新”。建议使用版本化迁移和 expand-and-contract：

1. 备份并验证恢复，评估锁表、数据量、复制延迟和执行时间。
2. Expand：先增加兼容字段、表或索引，保持旧版本仍可运行；必要时双写或异步回填。
3. 部署兼容新旧 Schema 的应用，灰度验证后逐步切流。
4. Contract：确认旧版本不再使用旧结构后，再清理旧字段和兼容逻辑。
5. 迁移脚本要可审计、幂等或可判断状态；应用回滚和数据回滚应分别设计。

生产执行前应在等规模环境预演，并明确负责人、监控指标和停止条件。`,
    tags: ['数据库', 'schema-migration', '发布工程', '回滚'],
  },
  'b8a9d836-1385-40e9-b187-89f38f7d347e': {
    answer: `Nginx 对域名解析的刷新方式取决于 upstream 写法和版本。常见动态解析方案是在 http/server 上下文配置：

\`\`\`nginx
resolver 10.96.0.10 valid=30s ipv6=off;
resolver_timeout 5s;
\`\`\`

再使用支持运行时解析的 upstream 配置或变量形式代理，并结合所用 Nginx 版本验证行为。TTL/valid 不宜盲目设得过短，避免给 CoreDNS 带来额外压力。

其他思路包括：让 Nginx 代理稳定的 Kubernetes Service ClusterIP；使用 Ingress/Gateway Controller；使用能够监听 EndpointSlice 变化的服务发现方案。Headless Service 仍然依赖 DNS，而且会直接返回 Pod IP，不能说它“避免 DNS 缓存”。`,
    tags: ['nginx', 'kubernetes', 'dns', 'coredns', '服务发现'],
  },
  'a61c2a22-b1be-4509-8063-cf5678355639': {
    answer: `托管 Kubernetes 与自建集群应从责任边界和业务约束比较：

- 托管集群：云厂商通常负责控制面可用性、部分升级和基础设施集成，上手较快；但会增加平台依赖、版本/插件限制、网络集成和持续费用。
- 自建集群：控制权和定制能力更强，可适配私有环境；同时需要团队承担控制面高可用、升级、安全补丁、备份恢复、监控和 7×24 运维。
- 选型维度：SLA、合规、网络与存储、可移植性、人员能力、升级节奏、灾备、总拥有成本和厂商锁定。

面试回答最后应补充本人真实使用过的平台、负责范围和实际取舍；如果没有相关经历，应明确说明，不要虚构。`,
    tags: ['kubernetes', '托管集群', '云平台', '架构选型', '个人经历'],
  },
  '08732b33-b5ed-4d36-96f3-717139f9be72': {
    answer: `Calico 常见的隧道封装是 IP-in-IP 和 VXLAN，两者都可配置为始终封装、仅跨子网封装或不封装。

- IP-in-IP：把原始 IPv4 包封装在另一个 IPv4 包中，协议号为 4，只支持 IPv4；Calico 常通过 BGP 分发 IPIP 池路由。
- VXLAN：使用 UDP 封装，常用端口 4789，可适配不便运行 BGP 的底层网络，并支持 IPv6（需满足内核条件）。
- CrossSubnet：同一二层子网内不封装，跨子网时才封装，用于减少开销。

选择时应核对云平台对协议的限制、MTU、底层可路由性、IPv6、BGP 运维和性能测试结果。IPIP 并非“不支持跨子网”，跨子网正是其常见场景。`,
    tags: ['kubernetes', 'calico', 'ipip', 'vxlan', 'overlay'],
  },
  '0b3f6c1e-ec86-4161-9f8a-41d2e273ce11': {
    answer: `Pod 监控应把不同数据源分开：

1. CPU、内存等容器资源使用量：由 kubelet/cAdvisor 暴露，可由 Prometheus 抓取；metrics-server 提供面向 HPA 和 kubectl top 的基础资源指标。
2. Kubernetes 对象状态：kube-state-metrics 从 API Server 生成 Deployment、Pod、PVC 等对象状态指标。
3. 节点指标：node-exporter 采集宿主机 CPU、内存、磁盘、文件系统和网络等操作系统指标，不是 Pod 资源采集器。
4. 存活与就绪：livenessProbe 影响容器重启，readinessProbe 决定是否接收 Service 流量，startupProbe 保护慢启动应用。
5. 还应结合应用指标、日志、Events、链路追踪和告警规则。

个人经历部分应说明真实使用的采集链路、仪表盘、告警阈值和处理案例。`,
    tags: ['kubernetes', 'prometheus', '监控', 'cadvisor', 'kube-state-metrics'],
  },
  '68387d86-1e4d-4120-98ed-5d796638ba73': {
    title: 'Pod 如何访问集群外部地址？',
    content: 'Pod 访问集群外部地址时，默认链路是什么？需要固定出口或受控出站时如何设计？',
    answer: `Pod 访问集群外部地址属于出站（egress）流量，NodePort、LoadBalancer 和 Ingress 主要解决外部客户端访问集群内服务，方向相反。

常见默认链路：
1. Pod 按路由把流量交给 CNI/节点网络。
2. 如果外部网络不能路由 Pod CIDR，节点或 CNI 通常对源地址做 SNAT/MASQUERADE，再从节点出口发送。
3. 返回流量依赖 conntrack 还原并送回 Pod。

排障时检查 Pod DNS、路由、NetworkPolicy、CNI、节点 IP 转发、SNAT 规则、防火墙/安全组和目标端口。需要固定出口 IP、审计或访问控制时，可使用 Egress Gateway、NAT Gateway、出口代理或云平台 egress 方案。

HostNetwork 不是普通出站的必要条件；Headless Service 用于服务发现，也与 Pod 访问外网不是同一个问题。`,
    tags: ['kubernetes', 'pod网络', 'egress', 'cni', '网络排障'],
  },
  '25d9ccf6-0e75-4eb9-bf3a-590ebe6f1f17': {
    answer: `Kubernetes Service 的 \`.spec.type\` 有四个有效值：

1. ClusterIP：默认类型，仅提供集群内部虚拟 IP。
2. NodePort：在每个节点开放端口，并建立在 ClusterIP 能力之上。
3. LoadBalancer：请求外部负载均衡实现；是否分配公网 IP 取决于云平台或集群中的实现和配置。
4. ExternalName：通过 DNS CNAME 映射到外部域名，不创建 ClusterIP 代理。

Headless Service 不是第 5 个 type。它通常仍是 \`type: ClusterIP\`，同时设置 \`clusterIP: None\`，不分配虚拟 IP，也不由 kube-proxy 做平台负载均衡，而是通过 DNS 返回后端端点地址。`,
    tags: ['kubernetes', 'service', 'headless-service', '服务发现'],
  },
  '411afae1-5dbe-4035-bed7-ca2994d3e8e1': {
    answer: `Service 的 \`.spec.type\` 有四种：ClusterIP、NodePort、LoadBalancer、ExternalName。

Headless Service 不是独立的第 5 种 type，而是通常使用 \`type: ClusterIP\` 并设置 \`clusterIP: None\` 的特殊 Service。它不分配 Service 虚拟 IP，DNS 会返回后端端点地址，常用于 StatefulSet 或需要客户端自行选择端点的场景。`,
    tags: ['kubernetes', 'service', 'headless-service'],
  },
  '3b531b45-286a-4479-97ac-39fa70d5ea9e': {
    answer: `查看连接时应补全端口或进程条件，例如：

\`\`\`bash
ss -antp
ss -ant '( sport = :443 or dport = :443 )'
ss -ant state time-wait | wc -l
\`\`\`

大量 TIME_WAIT 表示本机一侧主动关闭了很多 TCP 连接。先确认来源进程、远端、连接创建速率、四元组分布、端口耗尽和业务错误，再检查是否存在大量短连接、未复用连接池、Keep-Alive/上游超时不合理等问题。

\`net.ipv4.tcp_fin_timeout\` 控制的是孤儿连接在 FIN_WAIT_2 的时间，不会缩短 TIME_WAIT。不要把修改 \`tcp_tw_reuse\` 当作通用答案；必须结合内核版本、连接方向、压测和回滚计划评估。优先修复连接使用方式。`,
    tags: ['linux', 'tcp', 'time-wait', '网络排障', 'sysctl'],
  },
  '3d1b5076-a8a8-4e40-b51c-460075d33058': {
    answer: `\`maxSurge\` 和 \`maxUnavailable\` 只控制 Deployment 滚动更新时新增和不可用副本的数量，不控制新旧版本各自接收多少流量。

真正的灰度流量控制通常先部署可区分的新旧版本，再通过以下方式分流：
1. Gateway API、Ingress Controller 或服务网格配置权重，例如 10% 到新版本、90% 到旧版本。
2. 按 Header、Cookie、用户、地域或设备定向分流。
3. 使用两个 Service 配合网关/代理，避免同一个 Service 随机选择新旧 Pod。

灰度过程中持续观察错误率、延迟、资源和业务指标，设置自动/人工停止条件；验证通过后逐步扩大流量，异常立即切回旧版本。`,
    tags: ['kubernetes', '灰度发布', 'deployment', '流量治理'],
  },
  'f315c826-84b9-447c-acf3-e02d3b252d14': {
    content: 'Kubernetes 的架构由哪些组件组成？Linux 上的 kube-proxy 有哪些主要模式？',
    title: 'Kubernetes 架构与 kube-proxy 模式',
    answer: `Kubernetes 分为控制平面和工作节点：

- 控制平面：kube-apiserver、etcd、kube-scheduler、kube-controller-manager；云环境还可能运行 cloud-controller-manager。
- 工作节点：kubelet、符合 CRI 的容器运行时（常见 containerd、CRI-O）以及 kube-proxy。Docker Engine 需要通过 cri-dockerd 等 CRI 适配层接入，Kubernetes 1.24 已移除内置 dockershim。

当前 Linux kube-proxy 主要支持 iptables、IPVS 和 nftables 模式；nftables 在 Kubernetes 1.33 已稳定。回答时应结合目标 Kubernetes 版本，因为历史版本的可用模式和推荐程度不同。kube-proxy 负责 Service 虚拟 IP/端口的转发规则，不负责一般的 Pod CNI 网络。`,
    tags: ['kubernetes', 'kube-proxy', 'iptables', 'ipvs', 'nftables'],
  },
  'a66955b4-bd4d-4a22-97e8-23a6acd4544d': {
    answer: `四表和五链是两个维度：

四表：
1. filter：包过滤，常见链 INPUT、FORWARD、OUTPUT。
2. nat：地址转换，常见链 PREROUTING、INPUT、OUTPUT、POSTROUTING。
3. mangle：修改报文标记、TTL 等，覆盖五个常见链。
4. raw：在连接跟踪前处理，常见内建链是 PREROUTING、OUTPUT。

五链：
- PREROUTING：路由决策前。
- INPUT：目标是本机。
- FORWARD：经过本机转发。
- OUTPUT：本机产生。
- POSTROUTING：路由决策后、离开本机前。

实际规则还要说明表、链、匹配条件、动作、优先顺序和数据包方向。`,
    tags: ['linux', 'iptables', 'netfilter', '防火墙'],
  },
  '8c90335b-a80f-497a-9005-4e71ef5ca40d': {
    answer: `Calico 为 Pod 分配可路由 IP，并通过 Linux 路由/数据平面实现通信和 NetworkPolicy。它并不只有一种固定网络模型：

- 无封装路由：可使用 BGP 或其他路由编程方式传播 Pod 网段，数据包不做隧道封装。
- IP-in-IP：IPv4 隧道，可配置 Always、CrossSubnet 或 Never。
- VXLAN：UDP Overlay，也可配置 Always、CrossSubnet 或 Never；纯 VXLAN 场景可不依赖 BGP 做集群内部路由。

因此“Calico 永远是纯三层 BGP、从不使用隧道”是错误的。Pod IP 是否能被集群外直接路由，还取决于路由宣告、底层网络和安全策略。`,
    explanation: `核心是先确定 Calico 的实际数据平面和 IPPool 配置，再描述通信路径。Calico 支持无封装、IP-in-IP、VXLAN 和跨子网封装，不能把某一种部署模式当成全部能力。`,
    tags: ['kubernetes', 'calico', 'bgp', 'ipip', 'vxlan'],
  },
  'e621402b-3d2d-4328-b286-2f4b36f5454f': {
    answer: `如果限定“Calico 无封装 BGP 模式”与“Flannel VXLAN 后端”进行比较：

- Calico BGP 模式通过路由传播 Pod 网段，跨节点数据包通常不做隧道封装，性能和可观测性较直接，但要求路由设计正确。
- Flannel VXLAN 使用 UDP/VXLAN Overlay，底层只需节点 IP 可达，适配性较好，但存在封装和 MTU 开销。

需要明确，这只是两种具体模式的对比。Calico 本身也支持 IP-in-IP 和 VXLAN；Flannel 也有 host-gw 等后端。Pod IP 能否被集群外路由取决于实际路由宣告和底层网络，不能仅根据插件名称判断。`,
    explanation: `比较网络插件时必须限定后端模式。Calico 不等于“永远无隧道”，Flannel 也不等于“只有 VXLAN”；应从路由、封装、NetworkPolicy、MTU、底层约束和运维复杂度比较。`,
    tags: ['kubernetes', 'calico', 'flannel', 'bgp', 'vxlan'],
  },
  'b67f7079-a17e-4bea-8ba8-8084cb361dd0': {
    answer: `Deployment 主要管理无状态工作负载；StatefulSet 用于需要稳定身份、稳定网络标识和有序操作的工作负载。

1. Pod 名称：Deployment Pod 通常为 \`<deployment>-<replicaset-hash>-<suffix>\`；StatefulSet 为 \`<statefulset>-<ordinal>\`，例如 web-0。
2. 创建/缩容：Deployment 通常可并行；StatefulSet 默认按序创建、逆序缩容，也可配置 PodManagementPolicy。
3. 网络身份：StatefulSet 常配合 Headless Service 提供稳定 DNS。
4. 存储：StatefulSet 可通过 volumeClaimTemplates 为每个副本创建独立 PVC。Deployment 也能挂载 PVC，但删除一个 Deployment Pod 不会自动删除 PVC；需要区分 PV 回收策略和 StatefulSet PVC 保留策略。
5. 更新：Deployment 与 StatefulSet 都支持滚动更新，但顺序、分区和可用性语义不同。

数据库是否适合 StatefulSet 还取决于应用自身复制、存储和故障恢复能力。`,
    tags: ['kubernetes', 'deployment', 'statefulset', 'pvc'],
  },
  '8d5e5e96-66f2-4166-93ab-24c55799b4dc': {
    title: 'Pod 的网络与存储分别由哪些组件协作管理？',
    content: 'Pod 的网络与存储分别由哪些组件协作管理？pause 容器起什么作用？',
    answer: `Pod 网络不是由 pause 容器“管理”的：

- pause/infra 容器主要持有 Pod 共享的网络等 Linux namespace，其他业务容器加入这些 namespace。
- kubelet 通过 CRI 与容器运行时协作，运行时调用 CNI 插件为 Pod 配置接口、IP、路由和清理网络。

Pod 存储由多个组件协作：
- kubelet 根据 PodSpec 准备并挂载卷；
- CSI 驱动及相关控制器完成卷供应、附加、挂载和扩容；
- emptyDir 等临时存储、容器可写层和日志受到节点临时存储及垃圾回收策略影响。

因此应区分“namespace 持有者”“网络配置者”和“存储生命周期管理者”。`,
    tags: ['kubernetes', 'pause容器', 'cni', 'cri', '存储'],
  },
  'fbaa73dd-e307-4dfe-abf1-dae0366d63da': {
    answer: `Pod 级 \`restartPolicy\` 有 Always、OnFailure、Never，默认是 Always。它主要控制 kubelet 如何在同一个 Pod、同一节点上重启已经退出的容器，而不是“重启原 Pod 对象”。

- Always：容器无论成功还是失败退出都重启。
- OnFailure：仅非零退出时重启。
- Never：容器退出后不自动重启。

Deployment/ReplicaSet 的 Pod 模板只允许 Always；Job 常用 OnFailure 或 Never。控制器在 Pod 丢失或失败时创建替代 Pod，与 kubelet 在原 Pod 内重启容器是两个不同层次的机制。`,
    tags: ['kubernetes', 'pod', 'restartpolicy', 'kubelet'],
  },
  '872fe668-4eea-45f9-8157-89a16168ef33': {
    answer: `不同命名空间的 Pod 默认可以通过集群网络互通，除非 NetworkPolicy 或其他安全策略限制。推荐通过 Service 访问：

- 完整域名：\`<service>.<namespace>.svc.cluster.local\`
- 常用跨命名空间短名：\`<service>.<namespace>\`

Pod IP 可以直连，但 Pod 重建后地址可能变化，不适合作为稳定依赖。Ingress/Gateway、NodePort、LoadBalancer 主要解决集群外或特定入口访问，普通跨命名空间通信不需要绕到集群外。排障时检查 DNS、Service/EndpointSlice、端口、NetworkPolicy 和 CNI。`,
    tags: ['kubernetes', 'namespace', 'service', 'dns', 'networkpolicy'],
  },
  '764dde13-1719-4810-bb24-72e676c7ff4c': {
    answer: `Kubernetes 集群 DNS 通常由 CoreDNS 提供。它监听 Service、EndpointSlice 等资源，为 Service 生成 DNS 记录。

同命名空间 Pod 可使用 \`<service>\`；跨命名空间通常使用 \`<service>.<namespace>\`；完整域名为 \`<service>.<namespace>.svc.cluster.local\`，其中集群域可能被管理员修改。

普通 ClusterIP Service 的 DNS 通常解析到虚拟 IP；Headless Service 则返回后端端点地址。排障可检查 Pod 的 resolv.conf、CoreDNS 日志与指标、Service、EndpointSlice 以及 NetworkPolicy。`,
    tags: ['kubernetes', 'service', 'dns', 'coredns'],
  },
  '875522a6-ee7d-46bc-a24c-f0e5d39769b4': {
    answer: `IPVS 和 iptables 都可以作为 Linux kube-proxy 的内核数据路径：

- iptables 模式通过 netfilter 规则完成 Service 转发，生态成熟；Service/Endpoint 很多时规则规模和同步成本可能增大。
- IPVS 模式使用内核 IPVS 四层负载均衡，支持 rr、wrr、lc 等调度算法，查找结构更适合大量 Service，但需要内核模块和额外虚拟接口/规则管理。

两种模式都由 kube-proxy监听 Service/EndpointSlice 变化并同步内核状态，不能说 iptables 每次必须人工“重新加载”。实际性能应结合 Kubernetes 版本、规则数量、连接模式和压测判断；当前版本还应同时了解 nftables 模式。`,
    tags: ['kubernetes', 'kube-proxy', 'ipvs', 'iptables', '网络'],
  },
  '794c1795-8c35-4bb3-9fe3-6eee90fd375d': {
    answer: `创建 Pod 的主要流程：

1. kubectl/客户端向 kube-apiserver 提交请求，经过认证、授权、准入后写入 etcd。
2. kube-scheduler 观察未绑定 Pod，选择节点并通过 API 写入绑定结果。
3. 目标节点 kubelet 观察到 PodSpec，通过 CRI 调用 containerd、CRI-O 等运行时准备 sandbox、拉取镜像并启动容器。
4. 容器运行时调用 CNI 插件配置 Pod 网络；kubelet/CSI 协作准备存储。
5. kubelet持续上报状态并执行探针。若 Pod 被 Service 选中，kube-proxy 或相应数据平面会更新 Service 转发规则。

kube-proxy 负责 Service 转发，不负责一般 Pod 出站；Docker Engine 需要 CRI 适配层才能用于已移除 dockershim 的 Kubernetes。`,
    tags: ['kubernetes', 'pod', '调度', 'cri', 'cni'],
  },
  '907dc521-fd2a-487b-8cce-c79d7c5fc7b9': {
    answer: `1. 编写 Pod 或 Deployment 清单，例如 \`nginx.yaml\`，指定镜像、端口、资源和探针，然后执行：

\`\`\`bash
kubectl apply -f nginx.yaml
\`\`\`

2. kube-apiserver 完成认证、授权、准入并持久化；scheduler 选择节点；kubelet 通过 CRI 调用 containerd/CRI-O 等运行时拉取镜像并创建容器；运行时调用 CNI 配置网络。
3. 只有创建了 Service 时，kube-proxy 或相应 Service 数据平面才会配置访问规则。
4. 使用 \`kubectl get pod\`、\`kubectl describe pod <pod>\` 和 \`kubectl logs <pod>\` 验证状态。

Docker Engine 在现代 Kubernetes 中需要 cri-dockerd 等 CRI 适配层。`,
    tags: ['kubernetes', 'nginx', 'pod', 'kubectl', 'cri'],
  },
  'e1c52bdd-080d-44cb-bbeb-ef3b95c41d18': {
    answer: `控制平面核心组件：
- kube-apiserver：Kubernetes API 入口，负责认证、授权、准入和资源操作。
- etcd：一致性键值存储，保存集群状态。只有按法定人数正确部署、备份和运维时才具备高可用能力。
- kube-scheduler：为未绑定 Pod 选择节点。
- kube-controller-manager：运行各类控制器，使实际状态趋向期望状态。
- cloud-controller-manager：在支持的云环境中对接云资源。

节点组件：
- kubelet：根据 PodSpec 通过 CRI 管理容器并上报状态。
- 容器运行时：运行容器。
- kube-proxy：实现 Service 虚拟 IP/端口的四层转发；它不负责一般 Pod 出站网络。Pod 网络通常由 CNI 数据平面负责。`,
    tags: ['kubernetes', '控制平面', 'etcd', 'kube-proxy'],
  },
  'e666d6ce-cc8a-4d30-8870-feaa6a4e2305': {
    answer: `Pod 名称：
- Deployment Pod 通常是 \`<deployment>-<replicaset-hash>-<suffix>\`，没有稳定序号。
- StatefulSet Pod 是 \`<statefulset>-<ordinal>\`，例如 web-0、web-1，身份稳定。

更新策略：
- Deployment 默认 RollingUpdate，通过 maxSurge 和 maxUnavailable 控制并发；也支持 Recreate。
- StatefulSet 默认 RollingUpdate，通常按序号从高到低更新，并支持 partition；也可使用 OnDelete。

“Deployment 更新过程中一定不会中断”不成立。是否无中断取决于副本数、readiness/startupProbe、maxUnavailable、容量、优雅退出、PDB、会话状态和依赖兼容性。`,
    tags: ['kubernetes', 'deployment', 'statefulset', '滚动更新'],
  },
  '3481fd2e-b9ad-44f4-b7c2-6099bbe4c589': {
    answer: `Kubernetes 扩缩容分为多个层次：

- HPA：根据 CPU、内存或自定义/外部指标调整工作负载副本数，资源指标常由 metrics-server 提供。
- VPA：根据历史和当前使用量给出或应用容器资源 requests 建议；更新模式可能需要驱逐并重建 Pod，limits 的处理取决于策略和版本，不能笼统理解为原地自动修改所有 requests/limits。
- Cluster Autoscaler/节点自动扩缩：Pod 因资源不足无法调度时增加节点，低利用率时在满足约束后缩容节点。

个人经历请按真实情况补充：使用的指标、min/max、副本稳定窗口、PDB、缩容保护、一次实际效果和遇到的问题；没有使用过应明确说明。`,
    tags: ['kubernetes', 'hpa', 'vpa', '自动扩缩容', '个人经历'],
  },
  '058a3a78-cb1b-4d3d-bc76-00b3ed874fe6': {
    answer: `Kubernetes 的主要价值包括声明式部署、自愈、滚动发布、服务发现、弹性伸缩、资源调度和可扩展 API。

需要避免两个过度表述：
1. Kubernetes 不会天然提高所有应用的资源利用率，效果取决于 requests/limits、调度、弹性策略和工作负载特征。
2. Namespace 主要提供命名和管理边界，不等于完整的多租户安全隔离。多租户还需要 RBAC、NetworkPolicy、ResourceQuota、LimitRange、Pod Security、节点/运行时隔离和审计等措施。

回答时可结合业务规模说明使用 Kubernetes 带来的收益与新增的复杂度。`,
    tags: ['kubernetes', '架构', '多租户', 'namespace'],
  },
  '0a2c5487-66c7-4e42-82d0-caac378e8137': {
    answer: `安装 Kubernetes 前应以目标版本、发行版、CNI、容器运行时和 kube-proxy 模式的官方要求为准：

1. 配置主机名、DNS、时间同步、证书时间和稳定网络。
2. 安装并配置 CRI 运行时，核对 cgroup driver。
3. 配置 IP 转发及 CNI 所需内核模块/sysctl；桥接 netfilter 参数是否需要取决于数据平面。
4. Swap 应按 Kubernetes 版本和 NodeSwap 配置决定，不能脱离版本一律关闭。
5. 只有使用 IPVS 模式才需要相应 IPVS 内核模块；当前还可能使用 iptables/nftables。
6. 不应直接关闭防火墙，应按控制面、节点、CNI 和业务需要开放最小端口并验证规则。
7. 规划 Pod/Service CIDR、MTU、磁盘、日志、内核版本和资源预留。

变更前保存基线和回滚方法，安装后运行健康和网络连通性测试。`,
    tags: ['kubernetes', '集群部署', 'linux', '内核参数', '安全'],
  },
  'b6698d8c-f2de-466c-b976-e72b022e16d1': {
    answer: `题目已确认 B 服务器的 80 端口处于监听且服务健康，因此重点排查 A 到 B 的访问路径：

1. 在 A 上确认目标地址、DNS 和路由：\`ip route get <B_IP>\`。
2. 测试 TCP 而不只依赖 ping：\`nc -vz <B_IP> 80\`、\`curl -v http://<B_IP>/\`。
3. 在 A、B 两端检查防火墙、安全组、ACL 和策略路由；使用精确允许规则，不要直接停止 firewalld。
4. 在 B 上确认监听地址：\`ss -lntp '( sport = :80 )'\`。若只监听 127.0.0.1，远端无法访问；通常应监听实际网卡地址或 \`0.0.0.0\`。
5. 两端抓包：\`tcpdump -ni any host <peer_ip> and port 80\`，判断请求是否到达、响应是否返回。
6. 检查反向路径、重复 IP、邻居表、交换机 VLAN/端口隔离等二层问题。

不要再把“服务未启动、80 被其他进程占用”列为主要原因，因为这与题目前提冲突。`,
    tags: ['linux', '网络排障', 'tcp', '防火墙'],
  },
  '75de5a4e-4cef-42aa-a2af-2c56391bf8c7': {
    answer: `在“Calico 无封装 BGP”和“Flannel VXLAN”这两个具体模式下：

- Calico 通过 BGP/路由传播 Pod 网段，数据包通常不封装，需保证节点之间和相关路由可达。
- Flannel VXLAN 通过 UDP/VXLAN 封装，底层只需节点 IP 可达，但要考虑封装开销和 MTU。

“Calico BGP 必须要求物理网络设备参与”并不准确。Calico 可使用节点间 BGP mesh，不一定需要 ToR 交换机做 BGP peer；只有需要向底层网络或集群外宣告 Pod 路由时，才可能与网络设备建立 BGP 对等。选型还要比较 NetworkPolicy、规模、故障域和运维能力。`,
    explanation: `该题必须限定具体后端模式。Calico BGP 可在节点间建立 mesh，也可与路由反射器或外部网络设备对等，不能笼统说“必须依赖网络设备”。`,
    tags: ['calico', 'flannel', 'bgp', 'vxlan', '网络方案对比'],
  },
  'e613e711-7a98-4f93-b3d6-d0e48ddb040a': {
    answer: `Calico 与 Flannel 不能只按“大小集群”二分，应按实际后端比较：

- Flannel 提供较简洁的 Pod 网络，常见 VXLAN，也有 host-gw 等后端；通常不独立提供完整 NetworkPolicy 能力。
- Calico 同时提供网络与 NetworkPolicy，支持无封装路由、BGP、IP-in-IP、VXLAN 等模式，功能更多但配置和排障面也更广。

性能取决于是否封装、MTU、内核、数据平面和流量模型，不能仅凭插件名称判断。选型应考虑网络策略、底层路由、云平台限制、IPv6、规模压测、团队运维能力和升级支持，而不是笼统地说 Flannel 只适合小集群。`,
    tags: ['kubernetes', 'calico', 'flannel', 'cni', '网络方案对比'],
  },
  'd8a03071-9d1f-4272-bebd-704e4e8765ca': {
    answer: `Kubernetes 持久化通常通过 PV、PVC、StorageClass 和 CSI 驱动管理，后端可以是云盘、Ceph、NFS、分布式块存储或 Local PV 等。

StorageClass 不是存储介质，而是描述动态供应、参数、回收策略、绑定模式等的配置。PVC 表达应用需求，PV 表示已供应的卷。

本地盘性能可能较好，但卷受节点约束；节点故障时不能像网络盘那样直接在其他节点挂载。数据库使用 Local PV 时必须结合 nodeAffinity、应用自身复制、反亲和、备份恢复、磁盘故障处理以及明确的 RPO/RTO，不能只因性能高就直接推荐。`,
    tags: ['kubernetes', '存储', 'pv', 'pvc', 'csi'],
  },
  'c07b167b-f92c-47ec-86cb-586e82928cbc': {
    answer: `Nginx 调优应先建立吞吐、延迟、错误率、CPU、内存、连接和磁盘 I/O 基线，再根据瓶颈调整：

1. \`worker_processes auto\` 通常比手写 CPU 数更稳妥；结合 CPU 亲和和容器配额验证。
2. 根据文件描述符上限、连接模型调整 worker_connections 和系统限制。
3. 合理配置 keepalive、超时、缓冲、缓存、压缩和上游连接池，避免通用参数照抄。
4. 日志应分级、采样、轮转和集中采集，不建议笼统关闭，以免失去审计和排障依据。

故障处理：先执行 \`nginx -t\`，检查进程、监听、错误日志、上游状态、DNS、证书、系统资源和网络；使用 \`curl -v\`、\`ss\`、\`tcpdump\` 等定位，并优先 reload 而非直接重启。任何调优都应压测、灰度并保留回滚配置。`,
    tags: ['nginx', '性能优化', '故障排查', 'linux'],
  },
  'c8011eca-e342-4f48-a18b-7cce2f330a66': {
    answer: `回答框架（请按本人真实经历补充）：

我会先识别发行版和版本，再选择包管理器或官方仓库；脚本需要幂等、可重复执行，并具备参数校验、错误处理、日志和退出码。

基本流程：
1. 检测系统：读取 \`/etc/os-release\`，区分 apt、dnf/yum 等。
2. 校验权限、网络、磁盘、端口和已有版本。
3. 使用受信任的软件源并校验包/签名，不固定下载过时版本。
4. 写入配置前备份，使用临时文件并通过语法检查后原子替换。
5. 使用 systemd 管理服务，启动后执行健康检查。
6. 失败时恢复配置或卸载本次变更；输出明确日志。

如果生产环境允许，优先使用 Ansible 等配置管理工具表达幂等状态，而不是维护一段只适用于旧版 CentOS 的一次性脚本。`,
    tags: ['shell', '自动化', 'nginx', '幂等性', '个人经历'],
  },
  '1f1de9dd-5d3e-482a-aeae-a5abe107b3a3': {
    answer: `可以从宿主机直接查看，也可以在容器内执行进程工具：

\`\`\`bash
docker top <container>
docker exec <container> ps aux
docker exec -it <container> sh
\`\`\`

\`docker top\` 不要求容器镜像内安装 ps，通常更可靠；\`docker exec\` 需要补全容器名，而且精简镜像可能没有 bash 或 ps。还可用 \`docker inspect <container>\` 查看入口命令、PID 和状态，再结合宿主机的 \`nsenter\`、\`ps\` 或监控系统排查。`,
    tags: ['docker', '容器', '进程', '故障排查'],
  },
  '2b2a4cd0-7979-4193-acc7-7a4da1fc0e8a': {
    title: 'Docker 镜像如何构建、导出和导入？',
    content: 'Docker 镜像如何构建、导出为文件并重新导入？',
    answer: `构建镜像：
\`\`\`bash
docker build -t myapp:1.0 .
\`\`\`

把已有镜像导出为 tar：
\`\`\`bash
docker save -o myapp-1.0.tar myapp:1.0
\`\`\`

重新导入：
\`\`\`bash
docker load -i myapp-1.0.tar
\`\`\`

\`docker build\` 是根据 Dockerfile 构建镜像；\`docker save/load\` 用于镜像归档。不要与 \`docker export/import\` 混淆，后者处理容器文件系统快照且不会完整保留镜像历史和元数据。`,
    tags: ['docker', '镜像', '命令题'],
  },
  '1b15343c-f675-4531-93b8-c3b87c383206': {
    answer: `判断 Calico 是否正常应分层检查：

1. 组件：\`kubectl get pods -n kube-system -l k8s-app=calico-node -o wide\`，以及 calico-kube-controllers 状态。
2. 日志：\`kubectl logs -n kube-system <calico-node-pod> -c calico-node\`，必须补全 Pod 和容器名。
3. 节点/CNI：检查 Node Ready、CNI 配置、IPPool 地址余量和 Felix 状态。
4. 数据平面：按实际模式检查路由、BGP、IPIP/VXLAN 接口、iptables/nftables/eBPF 状态。\`calicoctl node status\` 主要用于 BGP 状态，并不能代表所有模式都健康。
5. 连通性：从不同节点 Pod 测试 DNS、Service、Pod IP 和策略允许/拒绝路径。
6. NetworkPolicy：查看对象只证明配置存在，应通过正反向测试验证是否真正生效。

最后结合 Calico 指标、Events 和控制面日志定位。`,
    tags: ['kubernetes', 'calico', '故障排查', 'cni'],
  },
  '96fea094-61e1-471b-abc9-479419963ee1': {
    answer: `网络排障应从发起请求的位置执行并补全目标：

1. DNS：\`dig <hostname>\` 或 \`getent hosts <hostname>\`。
2. 路由：\`ip route get <target-ip>\`。
3. 连通性：\`ping <target-ip>\` 只能验证 ICMP，不能代表业务端口。
4. TCP 端口：\`nc -vz <host> <port>\` 或 \`telnet <host> <port>\`。
5. 应用层：按协议使用 \`curl -v\`、数据库客户端等。
6. Kubernetes：\`kubectl exec -n <namespace> <pod> -- <command>\`，再检查 Service、EndpointSlice、NetworkPolicy 和 CNI。
7. 抓包：在 Pod/节点合适位置执行 \`tcpdump -ni any host <ip> and port <port>\`，判断请求和响应停在哪一层。

不要只看 \`iptables -L\`；还需核对表、链、nftables、安全组和云网络 ACL。`,
    tags: ['linux', '网络排障', 'kubernetes', 'tcpdump', '命令题'],
  },
  'b2640ad2-33a8-414b-94ef-a6f40a8b3f0e': {
    answer: `扩容的是管理 Pod 的控制器副本数，例如 Deployment：

\`\`\`bash
kubectl scale deployment <deployment> -n <namespace> --replicas=3
\`\`\`

也可以修改清单中的 \`spec.replicas: 3\` 后执行：

\`\`\`bash
kubectl apply -f <manifest.yaml>
\`\`\`

临时编辑可使用 \`kubectl edit deployment <deployment> -n <namespace>\`。执行后通过 \`kubectl rollout status deployment/<deployment> -n <namespace>\` 和 \`kubectl get pods -n <namespace>\` 验证。若配置了 HPA，手工副本数可能随后被 HPA 调整，应先确认控制关系。`,
    tags: ['kubernetes', 'deployment', '扩缩容', 'kubectl'],
  },
  '6a173fe9-1315-4372-9681-7e0a01f98b79': {
    answer: `常用示例：

\`\`\`bash
free -h
df -h
du -sh /path
tail -F /var/log/nginx/access.log
awk '{print $1}' /var/log/nginx/access.log
awk '/GET/ {print $1}' /var/log/nginx/access.log
\`\`\`

\`df\` 看文件系统空间，\`du\` 看目录实际占用，含义不同。awk 的字段必须写成 \`$1\`，不能写成 \`$ 1\`。另外第 1 列是否为真实客户端 IP 取决于 Nginx log_format 和反向代理配置；使用 X-Forwarded-For 前必须正确配置可信代理和 real_ip 模块。`,
    tags: ['linux', 'nginx', 'awk', '命令题'],
  },
  '787ad601-07fd-417a-8130-6c9f90d8966b': {
    answer: `Kubernetes 是声明式容器编排平台，负责部署、调度、自愈、扩缩容、服务发现和发布。

Pod 与单个容器的区别：
1. Pod 是 Kubernetes 的基本调度单位，可包含一个或多个紧密协作的容器。
2. 同一 Pod 中的容器共享网络 namespace 和 Pod IP，可通过 \`localhost\` 通信，也可共享卷。
3. 容器是由运行时启动的进程隔离环境；Pod 还包含调度、重启策略、探针、卷和网络等编排语义。
4. kubelet可在同一 Pod 内重启容器；控制器则可在 Pod 丢失时创建替代 Pod。
5. 传统资源 requests/limits 主要配置在每个容器上，调度时按 Pod 中容器需求聚合；较新版本还可能提供版本受限的 Pod 级资源功能，回答时应说明版本。

Docker 只是容器工具/运行时生态之一，不应与 Pod 做完全同层级比较。`,
    tags: ['kubernetes', 'pod', 'docker', '容器'],
  },
  'e05d423e-3b2c-4d5b-aacd-e8d8c31687e9': {
    answer: `常用网络工具按用途分类：

- 地址和接口：\`ip addr\`、\`ip link\`
- 路由和邻居：\`ip route\`、\`ip route get <ip>\`、\`ip neigh\`
- 连接和监听：\`ss -antup\`；netstat 已较旧
- DNS：\`dig\`、\`nslookup\`、\`getent hosts\`
- 连通和路径：\`ping\`、\`tracepath\`、\`traceroute\`、\`mtr\`
- 端口/协议：\`nc\`、\`curl\`、对应数据库客户端
- 抓包：\`tcpdump\`、Wireshark
- 防火墙：\`nft\`、\`iptables\`

\`ss\` 主要查看 socket，不用它查看路由表；路由应使用 \`ip route\`。排障时按 DNS→路由→TCP→TLS/应用逐层验证。`,
    tags: ['linux', '网络', '故障排查', '命令题'],
  },
  '01ecade6-08d9-4f08-932b-580927244aba': {
    title: '两台节点上的 Pod 可以通过哪些路径通信？',
    content: '两台不同节点上的 Pod 可以通过哪些路径通信？请区分 Pod IP 直连与 Service 访问。',
    answer: `跨节点 Pod 通信常见两条路径：

1. Pod IP 直连：源 Pod 按路由把数据发给目标 Pod IP，CNI 数据平面负责跨节点可达。具体可能是无封装路由/BGP、IP-in-IP、VXLAN、云路由或 eBPF 数据平面，不能一概说由某个固定网桥完成。
2. 通过 Service：客户端访问 ClusterIP，kube-proxy 或其他 Service 数据平面选择 Endpoint 并做相应转发，之后仍由 CNI 网络把流量送到目标 Pod。

kube-proxy 不是跨节点 Pod IP 直连的必经组件；它主要实现 Service。排障时先判断访问目标是 Pod IP 还是 Service IP，再检查路由、隧道、MTU、NetworkPolicy、EndpointSlice 和节点防火墙。`,
    tags: ['kubernetes', 'pod网络', 'cni', 'service', '跨节点通信'],
  },
  '2d193b60-b177-4189-a5cd-06443bc387f1': {
    title: 'Kubernetes 如何实现网络分区与隔离？',
    content: 'Kubernetes 中 Namespace 和 NetworkPolicy 分别解决什么问题？如何实现网络隔离？',
    answer: `Namespace 主要提供资源命名和管理边界，本身不自动形成网络隔离；不同 Namespace 的 Pod 默认通常可以互通。

要实现网络隔离，应使用支持 NetworkPolicy 的 CNI，并创建入站和出站策略：
1. 先为目标 Namespace/Pod 建立默认拒绝策略。
2. 再按 PodSelector、NamespaceSelector、IPBlock 和端口添加最小允许规则。
3. 同时考虑 DNS、监控、镜像仓库和必要的外部依赖。
4. 通过允许和拒绝两类连通性测试验证策略真正生效。

多租户还需要结合 RBAC、ResourceQuota、Pod Security、节点隔离和审计，不能只依赖 Namespace。`,
    tags: ['kubernetes', 'namespace', 'networkpolicy', '网络隔离', '安全'],
  },
  '9b9a58a3-892a-4a19-8226-9f1d967f18b4': {
    title: 'Kubernetes 持久化存储的抽象与常见后端',
    content: 'Kubernetes 持久化存储包含哪些核心抽象？常见存储后端有哪些？',
    answer: `应区分 Kubernetes 存储抽象和实际后端：

核心抽象：
- PV：集群中的持久卷资源。
- PVC：工作负载对容量、访问模式等存储能力的申请。
- StorageClass：定义动态供应器、参数、回收策略和绑定模式等。
- CSI：存储驱动标准，负责供应、附加、挂载、扩容等能力。

常见后端包括云块存储、Ceph/RBD、NFS、分布式文件存储和 Local PV。不同后端在 ReadWriteOnce/ReadWriteMany、拓扑、性能、快照、扩容和故障恢复方面不同。

本地盘性能可能较好，但受节点故障和调度绑定限制；用于数据库前必须配合应用复制、备份恢复和明确的 RPO/RTO。`,
    tags: ['kubernetes', '存储', 'pv', 'pvc', 'csi'],
  },
  'de0faa16-e4d9-46bd-bc01-48ff9838fa8c': {
    answer: `Docker 使用客户端/服务端架构：Docker CLI 通过 Unix Socket 或受保护的远程 API 调用 Docker daemon，daemon 管理镜像、容器、网络和卷，并通过 containerd/runc 等组件创建和运行容器。

容器隔离和限制主要依赖 Linux namespaces、cgroups、capabilities、seccomp 和 LSM；镜像由内容寻址分层和写时复制存储驱动实现。现代 Linux 上常见存储驱动是 overlay2，而不是把所有实现笼统称为 UnionFS。

容器与虚拟机不同，它们共享宿主机内核，因此还需要正确配置镜像来源、最小权限、只读文件系统、资源限制和网络策略。`,
    tags: ['docker', '容器运行时', 'linux', '镜像'],
  },
  '13e5fe0b-db6c-4d9d-a4fa-8a86ec7b4cba': {
    answer: `同主机 Pod 的具体链路取决于 CNI 数据平面：

- 在 bridge 类 CNI 中，常见路径是源 Pod eth0 → veth pair → cni0 等 Linux 网桥 → 目标 Pod 的 veth → 目标 eth0。
- 在 Calico 路由模式中，流量可能通过主机路由和 veth 转发，不一定经过网桥。
- eBPF 数据平面还可能在 TC/XDP 等挂载点直接转发。

共同点是通信通常留在主机内部，不经过外部物理网络，但仍可能经过主机路由、netfilter/eBPF 和 NetworkPolicy。回答前必须说明所用 CNI 和模式，不能把 docker0/cni0 当成所有 Kubernetes 集群的固定组件。`,
    explanation: `同节点 Pod 通信没有唯一固定链路。bridge、路由型和 eBPF CNI 的路径不同；排障应从 Pod 路由、veth、主机路由/网桥和策略数据平面逐层确认。`,
    tags: ['kubernetes', 'pod网络', 'cni', 'veth', '网络'],
  },
  '6524e506-0d9c-4aca-b552-2486985081d4': {
    answer: `同节点 Pod 通信路径取决于 CNI：

1. bridge 模式：源 Pod eth0 → veth → cni0 等网桥 → 目标 veth → 目标 Pod。
2. 路由模式：源 Pod veth 进入主机后，由 Linux 路由表转发到目标 Pod 的 veth，不一定存在 cni0。
3. eBPF 模式：可能在 TC/XDP 等数据平面完成转发和策略处理。

这些路径通常不经过节点外部物理网络，但可能经过主机路由、netfilter/eBPF 和 NetworkPolicy。docker0 是 Docker 默认桥，不是 Kubernetes 的通用必备设备；Calico 也不一定使用 cni0。`,
    explanation: `题目应先确认 CNI 和数据平面。只有 bridge 类插件才能按固定 Linux 网桥路径描述；路由型和 eBPF 插件的转发路径不同。`,
    tags: ['kubernetes', 'pod网络', 'cni', 'veth', '网络'],
  },
  '1e60c74a-9a75-4758-b8eb-b3fed98db1fe': {
    answer: `在 Calico 无封装 BGP 模式下：

- 控制面：Felix 负责根据工作负载、IPPool 和策略编程本机路由/数据平面；BGP 组件与节点、路由反射器或外部路由器交换 Pod 网段。
- 数据面：Linux 内核按路由表把原始 IP 包转发到目标节点，通常不做隧道封装；NetworkPolicy 仍由配置的数据平面执行。

传统 Calico 部署常使用 BIRD，但现代版本/产品配置也可能使用其他 BGP 实现，回答时应以实际 Calico 版本和配置为准。BGP 对等关系可以是节点 mesh、路由反射器或外部网络设备，不等于必须修改物理交换机。`,
    explanation: `该题限定无封装 BGP 模式。应区分 Felix、BGP 路由传播和 Linux 数据面，并避免把 BIRD 写成所有现代 Calico 部署的固定实现。`,
    tags: ['kubernetes', 'calico', 'bgp', '路由', 'underlay'],
  },
  '467aba32-d9a1-4170-abcf-4ebf0e82a455': {
    answer: `VXLAN 是 MAC-in-UDP Overlay。以常见的基于 VXLAN 设备的 CNI 为例：

1. 源 Pod 的三层数据包按 Pod/节点路由到本机 VXLAN 设备。
2. 内核根据 FDB、邻居表或 CNI 编程结果确定远端 VTEP。
3. VXLAN 封装形成内层以太网帧 + VXLAN 头 + UDP + 外层 IP；外层源/目标是节点或 VTEP 地址，常用 UDP 4789，但具体端口取决于实现。
4. 底层网络只需让节点/VTEP IP 可达，并允许对应 UDP。
5. 目标节点解封装后，再按路由/二层信息送到目标 Pod。

具体从 Pod 到 VXLAN 设备的路径可能经过网桥、路由或其他数据平面，不能把“直接捕获 Pod 原始以太网帧”描述为所有 CNI 的唯一实现。还要考虑 MTU、分片、FDB 学习方式和 NetworkPolicy。`,
    explanation: `VXLAN 的标准封装是二层帧封装在 UDP 中，但 Kubernetes CNI 如何把 Pod 流量引到 VXLAN 设备因实现而异。回答应区分标准原理与具体插件路径。`,
    tags: ['kubernetes', 'vxlan', 'overlay', 'pod网络', 'cni'],
  },
  '1693ba45-da6d-4ed8-821e-0d05829e531f': {
    answer: `这道题必须使用本人真实故障案例，建议按“现象—影响—证据—根因—处理—复盘”回答。

可参考的排障结构：
1. 先说明影响范围和告警现象，例如节点 NotReady、Pod 无法调度、DNS/网络异常或控制面延迟。
2. 给出使用过的证据：Events、组件日志、etcd/kubelet/CNI 指标、网络抓包或时间线。
3. 区分直接原因和根因，并说明为何排除其他可能。
4. 描述止损、恢复、验证和回滚。
5. 给出后续改进，例如告警、容量、变更流程、备份和演练。

不要虚构“etcd 脑裂”。仅仅网络延迟并不等于脑裂，盲目增加 etcd 成员或调整心跳也可能降低稳定性。没有生产案例时，应明确说明做过哪些实验或演练。`,
    tags: ['kubernetes', '故障排查', '个人经历', '面试题'],
  },
  '1b5219c8-ad1a-4cdb-866c-3e5e9c6caf02': {
    answer: `回答时先区分真实巡检方式和可改进方案，不能直接声称脚本由本人编写。

一个可靠的巡检方案通常包括：
1. 主机：CPU、内存、磁盘、inode、网络、时间同步和关键系统服务。
2. 应用：进程、端口、健康检查、错误日志、证书和依赖。
3. 数据库/中间件：复制、连接、容量、延迟、积压和备份结果。
4. 输出：结构化报告、异常摘要、责任人和处理链接；异常进入告警或工单，而不是只发一封无人跟进的邮件。
5. 脚本质量：幂等、超时、并发限制、权限最小化、日志、退出码和失败重试。

个人部分请补充：哪些检查项是本人实现的、使用 Shell/Python/Ansible 的原因、一次发现的问题和改进结果；未亲自编写应如实说明。`,
    tags: ['巡检', 'shell', '自动化', '个人经历', '面试题'],
  },
  '30c9d27e-6471-4a29-b059-e6e3e494d4e3': {
    answer: `请按真实经历回答是否搭建过；没有生产搭建经验时可说明实验环境范围。技术上，一套 Prometheus 告警应包括：

1. 采集：明确 node-exporter、kubelet/cAdvisor、kube-state-metrics、应用指标等不同数据源。
2. 规则：同时关注可用性、错误率、延迟、饱和度和业务指标，阈值应来自容量基线/SLO，而不是统一写死 CPU 80%。
3. 降噪：设置持续时间、分组、抑制、静默和告警路由。
4. 通知：由 Alertmanager 发送到实际值班渠道，并关联仪表盘和 Runbook。
5. 验证：通过规则测试和故障演练确认告警能触发、能恢复且责任人明确。

个人经历需补充本人负责的组件、一个具体规则、一次误报/漏报改进和最终效果。`,
    tags: ['prometheus', '告警', '监控', '个人经历', '面试题'],
  },
  '48767613-fd83-4262-9c34-bfd499ad2122': {
    answer: `典型 CI/CD 流程可以这样说明，但必须根据真实公司流程调整：

1. 开发提交代码并创建合并请求，执行代码审查、静态检查、单元测试和依赖/镜像安全扫描。
2. 构建一次不可变制品或镜像，生成版本、SBOM 并推送制品库；不同环境复用同一制品。
3. 部署到测试/预发布环境，执行集成、接口和必要的性能测试。
4. 生产发布经过审批或变更策略，使用滚动、蓝绿或灰度方式，并配置健康检查和自动停止条件。
5. 持续观察技术与业务指标，失败时回滚应用；数据库变更使用兼容迁移和独立恢复方案。
6. 全过程保留审计记录、权限隔离和制品追踪。

个人部分请说明真实使用的 Git、流水线和部署工具，以及本人负责的阶段；不要直接声称“熟悉”或承诺滚动更新一定不中断。`,
    tags: ['ci-cd', '发布策略', '自动化', '个人经历', '面试题'],
  },
  '5437c6b7-76e7-44c5-9d1d-513e5c23ed4f': {
    answer: `IPv4 子网掩码用连续的 1 表示网络位、连续的 0 表示主机位。例如 \`255.255.255.0\` 等价于 \`/24\`，可结合网络地址、广播地址和可用主机范围解释。

安全漏洞修复属于个人经历，不能直接写“做过”。请按真实情况补充：
1. 漏洞来源：厂商公告、扫描器、依赖扫描或渗透测试。
2. 风险判断：受影响资产、可利用条件、暴露面和业务影响。
3. 修复：补丁/升级、配置缓解、访问控制，并先测试兼容性。
4. 验证：复扫、版本/配置核验和业务回归。
5. 闭环：资产清单、SLA、变更记录、回滚和复盘。

如果只做过实验，应明确实验范围，不要虚构使用 Nessus 或生产修复经验。`,
    tags: ['网络', '安全', '漏洞管理', '个人经历', '面试题'],
  },
  '61ae67fa-66a0-4c31-9cfa-b6cb5b2a66d6': {
    answer: `流量突然升高时，先确认是带宽、包速率、连接数还是应用 QPS 上升：

1. 节点/进程：\`sar -n DEV 1\`、\`ip -s link\`、\`ss -s\`；iftop/nethogs 可辅助查看实时流量，但生产使用要注意权限和开销。
2. 入口：查看负载均衡、Ingress/Nginx 的 QPS、状态码、延迟、URI、来源和连接数。
3. 应用：结合 Prometheus/APM 查看实例、接口、错误率、线程池、连接池和依赖延迟。
4. 网络：必要时使用 \`tcpdump\` 限定接口、主机、端口和抓包大小，避免无过滤全量抓包。
5. 判断是否正常业务、重试风暴、爬虫/攻击、发布变化或下游变慢，并采取限流、扩容、熔断或封禁等对应措施。

面试时请如实说明本人实际用过的命令和案例；未使用过某工具不要写“用过”。`,
    tags: ['linux', '网络排障', '监控', '个人经历', '面试题'],
  },
  '9969488b-0e41-4861-a6dc-df5393e0e7bb': {
    answer: `Ansible 常用于软件安装、配置分发、服务管理、用户/权限、巡检和发布。常见模块包括 package/apt/dnf、copy、template、file、service/systemd、user、uri、command 和 shell。

\`ansible.builtin.command\` 不经过 shell，因此管道、重定向、变量展开以及 \`| > < & ;\` 等 shell 语法不会按 shell 方式解释。需要 shell 功能时才使用 \`shell\` 模块，并严格控制变量、引用和输入，降低命令注入风险。

优先使用专用模块而不是 command/shell，因为专用模块通常更幂等、可检查变更。个人经历请补充真实 playbook、角色、inventory、幂等处理和一次故障，不要直接声称“做过”或“用过”。`,
    tags: ['ansible', '自动化', 'command', 'shell', '个人经历'],
  },
  'a42cbd2a-7b46-4c73-b547-0552607a920d': {
    answer: `tcpdump 是命令行抓包工具，可按接口、主机、端口、协议和 TCP 标志过滤流量，用于定位握手失败、重传、RST、DNS、延迟和单向通信等问题。

常见示例：
\`\`\`bash
tcpdump -ni any host <ip> and port <port>
tcpdump -ni eth0 -s 0 -w capture.pcap 'tcp port 443'
\`\`\`

抓包应控制过滤条件、时长和文件大小，注意敏感数据与权限，并使用 Wireshark/tshark 分析时间线。Kubernetes 中还要选择正确抓包位置：Pod namespace、veth、节点物理口或隧道口。

“是否用过”请按真实情况回答；未实际使用时可说明理解的过滤语法和实验范围。`,
    tags: ['tcpdump', '网络排障', 'linux', '个人经历', '面试题'],
  },
  'd0b9cd17-8662-403e-8649-76fcb94a6fff': {
    answer: `这是个人经历题，不能直接声称写过。可以按以下结构说明真实巡检工具或脚本：

1. 目标：解决什么重复工作，例如主机健康、证书到期、备份结果或应用探活。
2. 输入和范围：资产来源、认证方式、并发和超时。
3. 实现：Shell/Python/Ansible 的选择，检查项、结构化输出和退出码。
4. 可靠性：幂等、错误处理、重试、权限最小化、日志和告警去重。
5. 安全：密钥管理、命令注入防护和敏感信息脱敏。
6. 结果：真实发现的问题、节省时间或误报改进。

不要把“发现异常后自动重启”作为默认做法；应先保留证据、限制重启次数并避免掩盖根因。没有相关实践时明确说明做过哪些练习。`,
    tags: ['shell', '自动化', '巡检', '个人经历', '面试题'],
  },
  'f2f93550-6121-40c0-9cc9-a0862fda97de': {
    answer: `Zabbix 由 Server、数据库、Web 前端，以及可选的 Agent、Proxy、Java Gateway 等组件组成。Server 通过主动/被动检查、SNMP、JMX、IPMI 等方式采集数据，按触发器产生事件并执行通知；Proxy 可用于分区采集和缓冲。

Zabbix Agent 既可被 Server/Proxy 轮询，也可主动发送检查结果，不能只描述为固定“Agent 推送给 Server”。

其他监控/可观测工具可按用途介绍：Prometheus + Alertmanager 处理指标与告警，Grafana 展示，Loki/Elastic 处理日志，OpenTelemetry 采集遥测数据。是否实际使用过必须按本人经历回答，并说明负责范围和一个真实告警案例。`,
    tags: ['zabbix', '监控', 'prometheus', '个人经历', '面试题'],
  },
  'f8bd24e8-2c67-4256-a1db-d3e74c27a987': {
    answer: `MySQL 常见监控维度：

- 可用性与连接：实例存活、当前/失败连接、连接使用率。
- 工作负载：QPS/TPS、读写比例、行扫描与临时表。
- InnoDB：Buffer Pool 命中与脏页、日志等待、锁等待和死锁。
- SQL：慢查询、执行时间、扫描行数和高频语句。
- 复制：副本 I/O/SQL 线程、GTID/位点、延迟和错误。
- 主机：CPU、内存、磁盘空间、IOPS、延迟和网络。

瓶颈处理必须先用慢日志、执行计划、Performance Schema 和系统指标定位。不能把“调大 max_connections、分库分表、修改 binlog 参数”当作通用答案；这些操作可能放大资源压力或引入新风险。

“遇到过什么瓶颈”请使用本人真实案例，说明证据、根因、变更、验证和结果；没有生产案例时如实说明。`,
    tags: ['mysql', '监控', '性能优化', '个人经历', '面试题'],
  },
};

const experienceIds = [
  '29c40dc0-70b2-413a-95e1-1cb73be39990',
  '5aae25f4-6476-4e2d-b188-c39e133202bd',
  '69b2c091-81ac-438f-a667-1d4e7b241086',
  '783695b7-c254-400b-b458-387e1db83197',
  '79c71f5f-c53b-4548-a8aa-206968c67c77',
  'fcd0d85c-5bb8-4331-a4ec-b9b1d4c997b9',
  '7225f416-4dd8-491d-93e7-f004b0d28fd8',
  '878320c2-1330-40e4-85e8-4e2ef712768b',
  '8ce4129b-ba46-4f46-b6e3-6fde5b02a91f',
  '5f9a0367-5dc9-407e-b587-1745f1ad1d18',
  'e368b58a-7366-4e8c-80f9-b97705bf0958',
];

const experienceFramework = (title) => `这是一道个人经历题，题库不能替你虚构经历。请按真实情况填写，建议结构：

1. 背景：公司/项目类型、环境规模和业务目标（不便透露时使用区间）。
2. 本人职责：明确“我负责”与“团队负责”的边界。
3. 实际行动：使用的技术、关键步骤、为什么这样选择。
4. 难点或故障：遇到的问题、排查证据和取舍。
5. 结果：使用可核实指标，例如耗时、可用性、成本或故障恢复时间。
6. 复盘：不足、后续改进和真实能力边界。

当前题目：${title}

待填写：请用本人的真实项目内容替换本段；没有相关经验时直接说明“没有生产实践，但了解基本原理/做过实验”，不要编造公司、人数、服务器数量或项目指标。`;

const tagAliases = new Map([
  ['pod 网络', 'pod网络'],
  ['pod-network', 'pod网络'],
  ['overlay网络', 'overlay'],
  ['overlay 网络', 'overlay'],
  ['k8s', 'kubernetes'],
  ['K8S', 'kubernetes'],
  ['Kubernetes', 'kubernetes'],
]);

const normalizeTag = (tag) => tagAliases.get(String(tag).trim()) || String(tag).trim().toLowerCase();

const tagRules = [
  [/(k8s|kubernetes)/i, 'kubernetes'],
  [/\bpod\b/i, 'pod'],
  [/\bservice\b|clusterip|nodeport|headless/i, 'service'],
  [/deployment/i, 'deployment'],
  [/statefulset/i, 'statefulset'],
  [/calico/i, 'calico'],
  [/flannel/i, 'flannel'],
  [/\bcni\b/i, 'cni'],
  [/docker|dockerfile/i, 'docker'],
  [/containerd|\bcri\b|容器运行时/i, '容器运行时'],
  [/mysql|mariadb/i, 'mysql'],
  [/redis/i, 'redis'],
  [/nginx/i, 'nginx'],
  [/prometheus/i, 'prometheus'],
  [/zabbix/i, 'zabbix'],
  [/opentelemetry|otel/i, 'opentelemetry'],
  [/grafana/i, 'grafana'],
  [/kafka/i, 'kafka'],
  [/rabbitmq/i, 'rabbitmq'],
  [/elasticsearch|\belk\b|\befk\b/i, 'elasticsearch'],
  [/ansible/i, 'ansible'],
  [/jenkins|gitlab|ci\/cd|流水线/i, 'ci-cd'],
  [/shell|\bbash\b|\bawk\b|\bsed\b/i, 'shell'],
  [/iptables|netfilter|firewalld|防火墙/i, '防火墙'],
  [/tcp|udp|网络|路由|dns|vxlan|ipip|bgp/i, '网络'],
  [/linux|服务器|内核|磁盘|内存/i, 'linux'],
  [/数据库|sql|oracle/i, '数据库'],
  [/监控|指标|告警|可观测|日志/i, '监控'],
  [/云|阿里云|腾讯云|aws|azure/i, '云平台'],
  [/vmware|vcenter|虚拟化/i, '虚拟化'],
  [/安全|secret|证书|权限|rbac/i, '安全'],
  [/高可用|故障|排查|主库挂|异常/i, '故障排查'],
];

const categoryRules = [
  ['项目与个人经历', /公司规模|运维团队|旧的公司|做得不错的项目|自我评价|个人经历|私有化部署|生产环境一共有/i],
  ['云平台与虚拟化', /阿里云|腾讯云|aws|azure|云平台|公有云|vmware|vcenter|虚拟化/i],
  ['安全与权限', /安全|权限|rbac|secret|证书|防火墙/i],
  ['监控与可观测性', /prometheus|zabbix|grafana|opentelemetry|otel|监控|指标|告警|可观测|日志/i],
  ['数据库', /mysql|mariadb|oracle|数据库|sql/i],
  ['自动化与交付', /ansible|jenkins|gitlab|ci\/cd|流水线|自动化|发布|灰度|升级/i],
  ['中间件与分布式', /redis|kafka|rabbitmq|elasticsearch|zookeeper|中间件|分布式/i],
  ['Kubernetes 与容器', /k8s|kubernetes|\bpod\b|deployment|statefulset|calico|flannel|\bcni\b|docker|containerd|容器/i],
  ['Linux 与网络', /linux|iptables|netfilter|tcp|udp|路由|网络|nginx|shell|bash|awk|磁盘|内存/i],
];

function parseTags(raw) {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return String(raw).split(',').map((tag) => tag.trim()).filter(Boolean);
  }
}

function inferTags(question, extra = []) {
  const source = `${question.title}\n${question.content}\n${question.answer}`;
  const tags = [...parseTags(question.tags), ...extra].map(normalizeTag).filter(Boolean);
  for (const [pattern, tag] of tagRules) {
    if (pattern.test(source)) tags.push(tag);
  }
  if (tags.length === 0) tags.push('运维', '面试题');
  if (/你们|之前|做过|接触过|实际运用/i.test(question.title)) tags.push('面试题');
  return [...new Set(tags)].slice(0, 5);
}

function inferCategory(question) {
  if (experienceIds.includes(question.id)) return '项目与个人经历';
  const source = `${question.title}\n${question.content}`;
  return categoryRules.find(([, pattern]) => pattern.test(source))?.[0] || '综合运维';
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    charset: 'utf8mb4',
  });

  try {
    const [questions] = await connection.query('SELECT * FROM questions ORDER BY created_at, id');
    if (questions.length !== 213) {
      throw new Error(`安全检查失败：预期 213 道题，实际 ${questions.length} 道`);
    }
    const ownerIds = [...new Set(questions.map((question) => question.user_id))];
    if (ownerIds.length !== 1) {
      throw new Error(`安全检查失败：预期单一题库所有者，实际 ${ownerIds.length} 个`);
    }

    const questionById = new Map(questions.map((question) => [question.id, question]));
    const missingFixIds = Object.keys(fixes).filter((id) => !questionById.has(id));
    const missingExperienceIds = experienceIds.filter((id) => !questionById.has(id));
    if (missingFixIds.length || missingExperienceIds.length) {
      throw new Error(`安全检查失败：修订 ID 不存在：${[...missingFixIds, ...missingExperienceIds].join(', ')}`);
    }

    const categoryNames = [...categoryRules.map(([name]) => name), '综合运维'];
    const [existingCategories] = await connection.query(
      'SELECT id, name FROM categories WHERE user_id = ?',
      [ownerIds[0]],
    );
    const categoryIds = new Map(existingCategories.map((category) => [category.name, category.id]));
    for (const name of categoryNames) {
      if (!categoryIds.has(name)) categoryIds.set(name, randomUUID());
    }

    const proposed = questions.map((question) => {
      const fixed = fixes[question.id] || {};
      const experienceAnswer = experienceIds.includes(question.id)
        && /当前题目：|待填写：/.test(question.answer)
        ? experienceFramework(question.title)
        : undefined;
      const next = {
        ...question,
        ...fixed,
        answer: experienceAnswer || fixed.answer || question.answer,
      };
      const extraTags = experienceIds.includes(question.id)
        ? ['个人经历', '面试题']
        : fixed.tags || [];
      const tags = inferTags(next, extraTags);
      const categoryName = inferCategory(next);
      return {
        id: question.id,
        title: next.title,
        content: next.content,
        answer: next.answer,
        explanation: fixed.explanation !== undefined ? fixed.explanation : question.explanation,
        tags,
        categoryId: categoryIds.get(categoryName),
        categoryName,
        answerChanged: next.answer !== question.answer,
        metadataChanged: JSON.stringify(tags) !== JSON.stringify(parseTags(question.tags))
          || question.category_id !== categoryIds.get(categoryName)
          || next.title !== question.title
          || next.content !== question.content
          || (fixed.explanation !== undefined && fixed.explanation !== question.explanation),
      };
    });

    const summary = {
      mode: isApply ? 'apply' : 'dry-run',
      totalQuestions: questions.length,
      correctedAnswers: proposed.filter((item) => item.answerChanged).length,
      correctedMetadata: proposed.filter((item) => item.metadataChanged).length,
      categories: Object.fromEntries(categoryNames.map((name) => [
        name,
        proposed.filter((item) => item.categoryName === name).length,
      ])),
      questionsWithoutTagsAfter: proposed.filter((item) => item.tags.length === 0).length,
      questionsWithoutCategoryAfter: proposed.filter((item) => !item.categoryId).length,
    };

    if (!isApply) {
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
      return;
    }

    await connection.beginTransaction();
    try {
      const now = toMysqlDateTime();
      for (const name of categoryNames) {
        if (!existingCategories.some((category) => category.name === name)) {
          await connection.execute(
            `INSERT INTO categories
              (id, name, description, parent_id, user_id, created_at, updated_at)
             VALUES (?, ?, ?, NULL, ?, ?, ?)`,
            [
              categoryIds.get(name),
              name,
              `题库质量修复于 2026-07-23 创建的“${name}”分类`,
              ownerIds[0],
              now,
              now,
            ],
          );
        }
      }

      for (const item of proposed) {
        await connection.execute(
          `UPDATE questions
           SET title = ?, content = ?, answer = ?, explanation = ?, tags = ?, category_id = ?, updated_at = ?
           WHERE id = ?`,
          [
            item.title,
            item.content,
            item.answer,
            item.explanation,
            JSON.stringify(item.tags),
            item.categoryId,
            now,
            item.id,
          ],
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }

    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
