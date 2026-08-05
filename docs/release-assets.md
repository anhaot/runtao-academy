# Release 下载与离线导入

每个版本的 GitHub Release 包含预构建程序包、独立 Docker 镜像和 SHA-256 校验文件。应用镜像只使用明确版本号，不提供 `latest`。

## 文件说明

以 `v260805-1` 为例：

| 文件 | 用途 |
| --- | --- |
| `tech-growth-hub-v260805-1-prebuilt-linux-amd64.tar.gz` | 已编译 API、生产依赖、Web 静态资源、Compose 和配置示例 |
| `tech-growth-hub-api-v260805-1-linux-amd64.tar.gz` | API 的 amd64 Docker 镜像 |
| `tech-growth-hub-api-v260805-1-linux-arm64.tar.gz` | API 的 arm64 Docker 镜像 |
| `tech-growth-hub-web-v260805-1-linux-amd64.tar.gz` | Web 的 amd64 Docker 镜像 |
| `tech-growth-hub-web-v260805-1-linux-arm64.tar.gz` | Web 的 arm64 Docker 镜像 |
| `mariadb-12.3.2-linux-amd64.tar.gz` | MariaDB 的 amd64 Docker 镜像 |
| `mariadb-12.3.2-linux-arm64.tar.gz` | MariaDB 的 arm64 Docker 镜像 |
| `SHA256SUMS` | 所有压缩包的完整性校验值 |

## 校验下载文件

把同一 Release 的文件下载到一个目录后执行：

```bash
sha256sum -c SHA256SUMS
```

只下载部分文件时，`sha256sum` 会提示其余文件缺失；已下载文件显示 `OK` 即表示校验通过。

## 导入独立镜像

先根据服务器架构选择 `amd64` 或 `arm64`：

```bash
uname -m
```

- `x86_64` 使用 `linux-amd64`。
- `aarch64` 或 `arm64` 使用 `linux-arm64`。

导入示例：

```bash
gzip -dc tech-growth-hub-api-v260805-1-linux-amd64.tar.gz | docker load
gzip -dc tech-growth-hub-web-v260805-1-linux-amd64.tar.gz | docker load
gzip -dc mariadb-12.3.2-linux-amd64.tar.gz | docker load
```

确认镜像：

```bash
docker images --format '{{.Repository}}:{{.Tag}}'
```

导入后的应用镜像名称与 `compose.release.yaml` 完全一致，例如：

```text
ghcr.io/anhaot/tech-growth-hub-api:v260805-1
ghcr.io/anhaot/tech-growth-hub-web:v260805-1
mariadb:12.3.2
```

## 离线启动

1. 解压预构建程序包。
2. 复制 `.env.example` 为 `.env`。
3. 确认 `APP_VERSION` 与下载的 Release 版本一致。
4. 填写 JWT、AI 加密密钥和数据库密码。
5. 导入同一架构的三个 Docker 镜像。
6. 使用发布 Compose 启动。

```bash
cp .env.example .env
docker compose -f compose.release.yaml up -d
```

离线环境不会尝试拉取 API 或 Web 镜像；三个所需镜像全部导入后即可直接启动。
