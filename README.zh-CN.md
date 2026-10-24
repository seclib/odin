<div align="center">

# 🌐 Odin

[![CI](https://github.com/bilawalsidhu/gods-eye-view/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/bilawalsidhu/gods-eye-view/actions/workflows/ci.yml) [![Reached #1 on GitHub Trending](https://img.shields.io/badge/%231_GitHub_Trending-thank_you!-F0A63C?style=flat-square&logo=github)](https://x.com/bilawalsidhu/status/2093798887815348521)

**[English](README.md)** · **[Français](README.fr.md)** · **[Русский](README.ru.md)** · **[简体中文](README.zh-CN.md)** · **[日本語](README.ja.md)** · **[العربية](README.ar.md)**

> [!NOTE]
> **多语言文档声明：** 本简体中文文档旨在为中文社区提供技术参考。项目的官方权威技术规范以[英文原版 README](README.md)为准。欢迎社区成员通过 Pull Request 协助审校并改进文字表述。

> [!IMPORTANT]
> **Odin** 是开源项目 [God's Eye View](https://github.com/bilawalsidhu/gods-eye-view) 的独立主权分支（Fork）。上游项目最初由 [Halfpixel](https://halfpixel.ai) 的 [Bilawal Sidhu](https://github.com/bilawalsidhu) 和 [Sameh Khamis](https://github.com/samehkhamis) 创建。
> 本分支由 **[Seclib](https://github.com/seclib)** 在 MIT 许可证下维护与发布。完整署名信息、改动清单及第三方数据许可详见 [NOTICE.md](NOTICE.md)。

### 浏览器中的实时地理空间情报态势控制台 — 公共公开信号、真实遥测数据、自主受控架构。

逼真 3D 地球。实时航班、船舶、在轨卫星、地震活动、实时路况及公共监控摄像头。支持通过本地自主 AI 平台或云端智能体实现免提语音交互与情报态势综合。

_俯瞰全球，洞察无遗。_

![轨道 HUD、实时地球与 FLIR 热成像扫描](docs/media/hero-open-source-reveal.gif)

<a href="https://www.youtube.com/@bilawalsidhu">
  <img src="docs/media/youtube-popular-videos.png" alt="YouTube 上的 God's Eye View 系列视频" width="100%">
</a>

▶️ **源自 YouTube 现象级 God's Eye View 演示项目** _(前称 WorldView)_ — [全网播放超 2500 万次](https://www.google.com/search?q=god%27s+eye+view) · 🏆 **荣登 GitHub Trending 趋势榜榜首**

⚡ **无需 API 密钥即可立即运行。** 支持通过 Docker Compose 或 Node.js 本地启动。20 个数据图层中有 18 个完全免费且无需秘钥。 **[→ 快速开始](#-快速开始)**

</div>

---

<div align="center">

**[快速开始](#-快速开始) · [渊源与改动](#-渊源分支与-seclib-改动) · [功能与限制](#-功能特性与技术限制) · [数据源与依赖](#-数据源与外部依赖) · [图层数据源](#-地球上的数据图层) · [AI 架构](#-ai-能力本地-ethan-与云端模型) · [隐私与安全](#-隐私安全模型与网络通信) · [许可证说明](NOTICE.md) · [参与贡献](CONTRIBUTING.md)**

</div>

---

## 🏛️ 渊源、分支与 Seclib 改动

Odin 是开源项目 **God's Eye View** 的独立维护分支，原作者为 Bilawal Sidhu 与 Sameh Khamis (Halfpixel)。

### 为何创建该分支

上游项目验证了将开源地理空间信号（ADS-B 广播式自动相关监视、AIS 船舶自动识别、SGP4 轨道六数、全球地震仪、市政监控探头、气象雷达）融合到 3D 沉浸式地球的可行性。

**Seclib** 创建并维护 **Odin** 分支，旨在将该架构提升至满足高保障、自主可控与隐私保护严苛环境的要求：
- **AI 本地主权与脱敏：** 将空间智能分析与云端闭源模型彻底解耦，原生支持通过 **ETHAN** 平台在本地算力上私有化运行。
- **容器加固与网络隔离：** 严格限制网络监听至回环接口（Loopback），强化代理隔离，杜绝未经授权的局域网泄露。
- **全方位多语言本地化：** 提供覆盖六大主流语言的原生语言包，并针对阿拉伯语实现完整的从右至左（RTL）镜像布局。
- **清晰规范的知识产权与数据许可边界：** 将 MIT 许可证代码与受非商业（NC）或相同方式共享约束的第三方数据集清晰剥离。

### Seclib 所做的核心修改

所有改动均保持与上游场景格式的向下兼容：

1. **品牌与项目标识：** 正式命名为 **Odin**，由 Seclib 维护，保留上游完整署名至 [NOTICE.md](NOTICE.md)。
2. **ETHAN 平台原生集成：**
   - 通过环境变量 `GEV_ETHAN_API_URL` 与 `GEV_ETHAN_API_KEY`/`GEV_ETHAN_TOKEN` 原生对接 ETHAN 本地模型服务。
   - 战术 HUD 概览完全可由本地离线模型（Ollama / vLLM / ETHAN）生成，数据绝不上传至任何外部云服务。
3. **加固 Docker 容器及网络安全防护：**
   - `compose.yaml` 默认严格绑定至 `127.0.0.1:4173`，避免在局域网内意外暴露服务端代理的密钥。
   - 通过 `GEV_ALLOWED_HOSTS` 严格校验 HTTP 请求 Host 标头，防御 DNS 重绑定攻击。
   - 默认禁用不安全的第三方穿透隧道及未经认证的网络网关。
4. **多语言国际化架构 (i18n)：**
   - 完整提供**英语** (`en`)、**法语** (`fr`)、**俄语** (`ru`)、**西班牙语** (`es`)、**简体中文** (`zh-CN`)、**日语** (`ja`) 及**阿拉伯语** (`ar`) 的翻译字典。
   - 针对阿拉伯语实现完整的页面及交互组件 RTL 镜像渲染。
5. **合规性与资产许可审计：**
   - 标明带有非商业限制的公开数据集（如 `TeleGeography` 海底光缆、`Bhote Koshi` 灾害数据）。
   - 在 [SECURITY.md](SECURITY.md) 中建立负责任的漏洞披露通道。

---

## ⚠️ 功能特性与技术限制

Odin 融合公共开源情报，但使用者必须清晰区分直接遥测、数学预测模型与人工模拟：

```
┌───────────────────────┬───────────────────────────────┬──────────────────────────────────────────┐
│ 信号类别              │ 涵盖图层                      │ 数据本质与现实限制                       │
├───────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ 实时观测遥测          │ 民航客机、军用 ADS-B、        │ 来自应答机的真实信号；每 15–30 秒刷新；  │
│                       │ AIS 船舶、USGS 全球地震       │ 在数据点之间做平滑线性插值。             │
├───────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ 数学计算与外推模型    │ 在轨人造卫星、                │ 基于 CelesTrak TLE 根数的 SGP4 轨道推算；│
│                       │ 全球风场与天气 (GFS/ECMWF)    │ nowCOAST 气象雷达拼图；数值天气预报。    │
├───────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ 轨迹重构与大致估计    │ 火箭发射轨迹 (Falcon 9)、     │ 标有 RECONSTRUCTED ESTIMATE：基于轨道    │
│                       │ 监控摄像头覆盖视锥            │ 动力学模型的发射模拟，非实况雷达测控。   │
│                       │ (CCTV Viewshed)               │ CCTV 探头指向由人工通过 3D 轴标定。      │
├───────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ 综合合成模拟          │ 实时模拟交通流                │ 沿 OpenStreetMap 真实路网运动的虚拟车流；│
│                       │                               │ 速度依据 TomTom 拥堵数据动态调节。       │
│                       │                               │ 光点并非现实中具体某辆车的真实定位。     │
├───────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ 信号完整度评估        │ GNSS 卫星导航完好性           │ 聚合自航班 ADS-B 报告的导航精度数值；    │
│                       │                               │ 低分仅代表信号劣化，不能直接断定人为干扰 │
└───────────────────────┴───────────────────────────────┴──────────────────────────────────────────┘
```

> [!IMPORTANT]
> **操作与安全免责声明：** Odin 定位为探索性空间数据可视化与情报态势感知客户端。所展示数据可能存在传输延迟、缺漏、推算误差或错误。
> **严禁**将 Odin 用于空中交通管制、海运航行避碰、应急灾害救援指挥、军事战术指挥、医疗急救决策或任何涉及生命安全的任务。关键操作务必以法定权威渠道发布的数据为准。

---

## ⚡ 快速开始

无需注册账号，**无需任何 API 密钥即可直接启动**。默认底图使用 Esri 卫星影像与开放地形数据。

### 方式一：Node.js 本地原生运行（推荐开发者使用）

系统要求：**Node.js 24 LTS (24.14.0+) 或 26.x**。

```bash
# 1. 克隆代码仓库
git clone https://github.com/seclib/odin.git
cd odin

# 2. 安装锁定版本的依赖项
npm ci

# 3. 运行环境与依赖就绪度自检
npm run doctor

# 4. 启动本地开发服务
npm run dev
```

在浏览器中打开：**`http://localhost:4173`**。

### 方式二：Docker Compose 容器化部署（推荐生产隔离）

系统要求：已安装 Docker Engine 与 Docker Compose。宿主机无需安装 Node.js。

```bash
# 1. 克隆代码仓库
git clone https://github.com/seclib/odin.git
cd odin

# 2. 传入宿主机用户身份并启动容器
env UID=$(id -u) GID=$(id -g) docker compose up
```

打开浏览器访问 **`http://localhost:4173`**。
- 持久化配置文件（`.env`、`.gev-cache/` 缓存、`.gev-logs/` 日志）均保存在宿主机目录中。
- 端口严格映射至 `127.0.0.1:4173`，杜绝局域网未授权访问。

### 方式三：Pinokio 一键启动器

1. 下载或升级 [Pinokio](https://desktop.pinokio.co/) 至 8.2 或更高版本。
2. 搜索 `odin` 或输入仓库地址安装。
3. 点击 **Install** 安装，随后点击 **Start** 运行。

---

## 🛠️ 配置说明与常见问题排查

### 图形界面配置 (Provider Settings)

点击界面右下角的 **POWER UP** 标签（或直接访问 `http://localhost:4173/?setup=1`）。在此处填写的各类第三方 API 密钥将安全持久化至本地 `.env` 文件。

### 环境变量与配置文件 (`.env`)

针对无头服务器或自动化流程，可从模板创建 `.env`：

```bash
cp .env.example .env
```

主要环境变量说明：
- `PORT=4173` — Web 服务监听端口。
- `HOST=127.0.0.1` — 绑定地址（仅在确定共享给局域网时设为 `0.0.0.0`）。
- `GEV_ALLOWED_HOSTS=localhost,127.0.0.1` — 允许的 Host 标头白名单。
- `GEV_ETHAN_API_URL=http://localhost:8000` — 本地 ETHAN 平台接口地址。
- `GEV_ETHAN_API_KEY=` — ETHAN 身份凭据。
- `OPENAI_API_KEY=` — 可选，用于云端语音与态势文本总结。
- `CESIUM_ION_TOKEN=` — 可选，获取免费 Cesium ion 托管的 Google 逼真 3D 城市与全球高精度地形。
- `GOOGLE_MAPS_API_KEY=` — 可选，直接调用 Google Maps 3D 瓦片与街景。
- `AISSTREAM_API_KEY=` — 可选，免费注册获取全球实时船舶追踪。

### 常见故障排除

1. **Docker 报错文件读写权限不足 (`EACCES`)：**
   - 原因：容器曾经以 `root` 用户运行生成了权限冲突的文件。
   - 解决：请务必加上用户参数启动：`env UID=$(id -u) GID=$(id -g) docker compose up`。
2. **地球渲染卡顿、帧率低：**
   - 原因：浏览器未开启硬件加速，导致 WebGL 退化为 CPU 软件渲染。
   - 解决：进入浏览器设置开启“在可用时使用图形硬件加速”，访问 `chrome://gpu` 查看显卡驱动状态。
3. **配置面板提示「Loopback Only」拒绝保存：**
   - 原因：正通过外部局域网 IP 或未授权的代理访问面板。
   - 解决：直接编辑宿主机 `.env` 文件，或在 [SECURITY.md](SECURITY.md) 指导下配置 `GEV_KEY_SETUP_TRUSTED_PEERS`。
4. **交通路况或 ALPR 图层无数据：**
   - 原因：OpenStreetMap 公共 Overpass 节点触发频率限制。内置代理会自动缓存；可执行 `npm run dev` 重启生效。

---

## 🛰️ 地球上的数据图层

二十个空间情报图层集于一体。**其中十八个图层无需提供任何秘钥即可运行。**

| 图层名称 | 数据覆盖与展示内容 | 数据提供商 | 访问许可要求 |
| :--- | :--- | :--- | :--- |
| 🗺️ **基础底图** | Esri 卫星影像、Google 逼真 3D、OpenStreetMap | Esri / Google / Cesium ion / OSM | 🟢 Esri 与 OSM 免费<br>🟡 Ion Google 3D 免费注册<br>🔴 Google 3D 直连按量计费 |
| ✈️ **民航航班** | 11,000+ 架在空客机及航迹回放 | OpenSky Network 与 adsb.lol | 🟢 无需秘钥 (🟡 可选 OpenSky 账号提升频次) |
| 🎖️ **军用航空** | 军用飞机、加油机、运输机及应答机紧急代码 | adsb.lol (过滤 ADS-B) | 🟢 无需秘钥 |
| 📡 **导航完整性** | 全球导航卫星信号质量与异常干扰区域制图 | adsb.lol 与 GPSJAM | 🟢 无需秘钥 |
| 🚢 **实时船舶** | 全球海运船舶追踪（货轮、油轮、客船、拖船） | AISStream.io | 🟡 免费注册获取 API Key |
| 🛰️ **人造卫星** | 830+ 重点在轨卫星 SGP4 实时轨道（含星链编队） | CelesTrak | 🟢 无需秘钥 |
| 🌍 **全球地震** | 过去 24 小时全球地震事件震中与震级 | USGS 美国地质调查局 | 🟢 无需秘钥 |
| 🔥 **火灾热点** | MODIS 与 VIIRS 卫星实时热异常探测 | NASA FIRMS | 🟡 免费注册获取 Map Key |
| 📹 **CCTV 监控网** | 投影在 3D 城市中的 4,000+ 市政交通探头 | TxDOT、Caltrans、TfL、Fintraffic 等 | 🟢 无需秘钥 |
| 🚗 **道路交通流** | 沿真实路网流动的模拟车流与路况拥堵色带 | OpenStreetMap + TomTom Flow | 🟢 基础模拟<br>🟡 TomTom 实时路况测速 |
| 📷 **实景街景** | 全景街拍照片与视线扇区查看 | Mapillary, Google, KartaView, Panoramax | 🟢 KartaView 与 Panoramax<br>🟡 Mapillary<br>🔴 Google |
| 📻 **全球广播电台** | 750+ 个地理定位电台，配有复古模拟调谐旋钮 | Radio Browser | 🟢 无需秘钥 |
| 🚌 **公共交通** | 公交、有轨电车、渡轮与铁路实时班次动态 | GTFS-Realtime 开放数据 | 🟢 无需秘钥 |
| 🚲 **公共自行车** | 共享单车站点桩位与可用车辆统计 | GBFS 开放数据 | 🟢 无需秘钥 |
| 🧭 **路径规划** | 驾驶、骑行、步行路径计算与无人机视角巡航 | OSRM / FOSSGIS | 🟢 无需秘钥 |
| 🚀 **航天发射** | 滚动 30 天全球火箭发射与升空轨道回放 | Launch Library 2 | 🟢 无需秘钥 (🟡 可选 Token 提高配额) |
| 🎖️ **军事设施标注** | 社区标注的雷达站与军事基地等外围轮廓 | OpenStreetMap | 🟢 无需秘钥 |
| 🌬️ **全球风场** | 10 米高度预报风向与风速动态粒子流动 | NOAA GFS / ECMWF IFS | 🟢 无需秘钥 |
| 🌦️ **气象雷达** | 降雨雷达多普勒图、红外云图及闪电落雷分布 | NOAA nowCOAST | 🟢 无需秘钥 |
| 🌀 **热带气旋** | 台风/飓风警报位置、预测路径与不确定性锥 | NOAA NHC / CPHC | 🟢 无需秘钥 |

_标识说明：_ 🟢 **完全无需秘钥** · 🟡 **官网免费注册申请** · 🔴 **商业按量计费**

---

## 🤖 AI 能力：本地 ETHAN 与云端模型

Odin 提供空间态势分析、实体属性问答以及全语意语音操作。

### 1. 基于 ETHAN 的本地自主智能（Seclib 扩展）

针对涉密、内网离线或对数据隐私要求极高的部署场景，Odin 与 **ETHAN** 原生适配：
- 战术 HUD 概览直接调用本地部署的 ETHAN 节点 (`GEV_ETHAN_API_URL=http://localhost:8000`)。
- 当前视口范围、高度层、活动图层及附近可疑目标将组装为情报简报并由本地模型分析。
- **数据完全不出本地：** 无任何提示词、视口坐标或视频流向外部网络传输。

### 2. 云端实时语音控制 (OpenAI)

- 采用 **OpenAI Realtime API** 通过 WebSocket 实现极低延迟的自然语音双向交互。
- **严苛的费用控制锁：** 单次会话设定 **$5.00** 硬性扣费上限，界面提供实时花费监视并在达到 $2.00 时告警。
- 支持 30 种空间操作语音指令：
  - _导航操纵：_ “带我去东京”、“以 30 度角缓慢绕飞维多利亚港”。
  - _地图标注：_ “圈出德克萨斯州边界”、“测量从巴黎埃菲尔铁塔到卢浮宫的直线距离”。
  - _情报研判：_ “英吉利海峡目前有多少艘油轮？”、“显示高度在三万英尺以上的军机”。
  - _视效切换：_ “切换至 FLIR 热成像夜视模式”、“进入最近那架客机的驾驶舱视角”。

### 3. Model Context Protocol (MCP) 服务端

Odin 内置符合行业标准的 MCP 服务端。各类编程助手和桌面智能体（如 Claude Desktop、Codex、ChatGPT）均可直接读取并编程控制 3D 地球。详见 [docs/MCP_SETUP.md](docs/MCP_SETUP.md)。

---

## 🔒 隐私、安全模型与网络通信

Odin 在架构设计上坚持深度防御策略：

### 1. 纯粹的本地优先运行
- Odin **不包含任何遥测、跟踪像素或第三方用户行为埋点代码**。
- 不会向 Seclib、Halfpixel 或上游原作者回传任何使用统计或设备诊断。
- 代码完全在本地浏览器和本地服务器运行，仅与被用户显式开启的数据源通信。

### 2. 敏感密钥完全由服务端代理隔离
高权限私密密钥（`OPENAI_API_KEY`、`AISSTREAM_API_KEY`、`OPENSKY_CLIENT_SECRET`、`GEV_ETHAN_API_KEY`）**绝不流入前端浏览器**。
- 浏览器仅调用本机的反向代理端点（`/api/vessels`、`/api/flights`、`/api/realtime/token`）。
- WebSocket 连接由服务端实时签发一次性、短有效期的会话 Token。
- 所有代理层均强制执行服务端请求伪造（SSRF）过滤、响应体积截断及超时断开机制。

### 3. 前端暴露密钥及其必备限制
仅有以下三个用于驱动浏览器端 WebGL 渲染的密钥由客户端加载：
- `GOOGLE_MAPS_API_KEY` (Google 3D 瓦片与 Maps JS API)
- `CESIUM_ION_TOKEN` (Cesium ion 3D 资产与地形)
- `MAPILLARY_CLIENT_TOKEN` (Mapillary 全景照片查看器)

> [!WARNING]
> 由于这三个密钥在浏览器开发者工具中可见，您**必须**在服务商后台进行安全绑定限制：
> - **Google Cloud 后台：** 配置 HTTP Referrer 来源限制（例如 `http://localhost:4173/*` 或您的域名），并收紧 API 权限（仅勾选 **Map Tiles API** 和 **Maps JavaScript API**）。
> - **Cesium ion 后台：** 绑定允许请求的域名，权限仅分配 `assets:read`。

### 4. 严苛的伦理红线
Odin 专为监测物理基础设施、机械设备、航行器、自然现象及公共传感网络设计。
- **绝不追踪个人：** 本项目坚决不包含，且未来绝不合并任何涉及人脸识别、车牌车主个人隐私匹配或针对特定自然人的跟踪功能。

---

> [!TIP]
> **注意：** 此部分已通过自动翻译添加，需经人工校对。

## 🗂️ 数据源与外部依赖

Odin 整合**公共开源情报数据流**与**本地渲染**。MIT 许可证仅涵盖应用程序代码——不包括第三方数据或视觉资产。每个提供方保留其自己的许可证和条款。

### 实时数据源（运行时获取）

| 数据源 | 用于 | 许可 / 条款 |
| --- | --- | --- |
| NOAA GFS（风） | 全球风场模型 | 公共领域（NOAA 数据在 AWS 上） |
| ECMWF IFS（风） | 备用风场模型 | CC BY 4.0 + ECMWF 服务条款 |
| NOAA nowCOAST | 雨格雷德、云红外、闪电 | 公共领域 |
| OpenSky Network | ADS-B 飞机位置 | 免费层 ; 条款适用 |
| adsb.lol | 过滤后的 ADS-B（军用、警方航班） | 免费 ; 条款适用 |
| AISStream.io | 船舶实时追踪 | 免费层 ; 条款适用 |
| CelesTrak | 轨道要素（TLE） | NASA 公共数据 |
| USGS Seismology | 全球地震数据 | 公共领域 |
| NASA FIRMS | 活跃火灾探测 | 公共领域（请求引用） |
| OpenStreetMap | 道路网络、共享单车、公共交通 | ODbL 1.0 |
| TomTom Flow | 交通流量速度 | 条款适用（见 `docs/OSRM-FOSSGIS.md`） |
| Mapillary / KartaView / Panoramax | 街道级影像 | 混合许可证 ; 见 DATA_SOURCES.md |
| Radio Browser | 带地理位置的电台 | 免费 ; 条款适用 |
| GTFS-Realtime 数据流 | 实时公共交通车辆位置 | 运营商条款 |
| GBFS 数据流 | 共享单车可用性 | 运营商条款（见 DATA_SOURCES.md） |
| OSRM / FOSSGIS | 路由和导航 | 免费 ; ODbL |
| Launch Library 2 | 火箭发射时间表 | 免费层 ; 条款适用 |
| TeleGeography 海底电缆地图（捆绑） | 电缆地图可视化 | [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/) — 禁止商业行为 + 相同许可 |

### 捆绑数据（存储在仓库中）

- **`src/data/local_data/`** — 捆绑数据集（TeleGeography 电缆地图、OpenStreetMap 提取物、事件影像等）
- **`public/models/`** — 3D 模型，附带单独许可证（见 [`public/models/README.md`](public/models/README.md)）

### 外部依赖

- **npm 包** — 记录在 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) 和 `package-lock.json`
- **Cesium ion** — 3D 瓦片的可选访问令牌；免费层可用
- **Google Maps Platform** — 3D 瓦片和街景的可选 API 密钥
- **云端 AI 提供方** — OpenAI（可选）用于云端语音和场景摘要；本地 ETHAN 用于主权替代方案

> [!CAUTION]
> **许可证边界：** MIT 许可证仅涵盖源代码。捆绑数据（TeleGeography CC BY-NC-SA 3.0、Bhote Koshi 事件影像 CC BY-NC 4.0）为非商业用途。请删除任何许可证不适合您使用的数据集，或获得必要的授权。详情见 [NOTICE.md](NOTICE.md)。

## 📜 许可证与知识产权边界

Odin 严格恪守开源规范，清晰划分代码与数据权利归属：

- **软件源代码：** 基于 **[MIT License](LICENSE)** 授权。Copyright © 2026 Bilawal Sidhu & Sameh Khamis (Halfpixel)，Seclib 分支修改部分 Copyright © 2026 Seclib。
- **第三方数据与限制性资源：**
  - **TeleGeography 全球海底光缆地图：** 采用 [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/)（非商业性使用、相同方式共享）。
  - **Bhote Koshi 洪灾数据集：** 采用 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)（非商业性使用）。
  - **3D 机型与载具模型：** 各模型独立许可证详见 [`public/models/README.md`](public/models/README.md)。
  - **演示素材：** 视频素材版权归原作者所有，详见 [`docs/media/README.md`](docs/media/README.md)。
  - **实时公开数据流：** 受各原始数据提供方服务条款规约。

详细版权公告与法律条款参见 [NOTICE.md](NOTICE.md)。

---

## 🤝 参与贡献、漏洞提报与版本更新

### 提交代码贡献

欢迎提交旨在提升稳定性、渲染能效、适配新型数据图层或优化翻译的 Pull Request：
1. 确保所有单元测试通过：`npm test`。
2. 验证多语言翻译字典完备性：`npm run i18n`。
3. 检查代码架构分层边界：`npm run check:boundaries`。
4. 遵守 [CONTRIBUTING.md](CONTRIBUTING.md) 中的代码风格指南。

### 安全漏洞负责任披露

如发现安全隐患或漏洞，请务必通过**私密渠道**提交反馈：
- 访问 GitHub 提交私密安全建议：`https://github.com/seclib/odin/security/advisories/new`
- 或发送邮件至安全响应邮箱：**security@seclib.org**。
- 请勿通过公开 Issue 披露可利用的漏洞。我们将在 48 小时内确认并协调修复。

### 检查与升级代码

将本地环境更新至最新分支：

```bash
# 本地 Git / Node.js 环境：
git pull origin main
npm ci
npm test

# Docker Compose 环境：
git pull origin main
docker compose down -v
docker compose up --build
```

---

<div align="center">

**Odin — 主权 3D 地球空间态势情报系统** · 由 [Seclib](https://github.com/seclib) 维护  
_基于 Bilawal Sidhu 与 Sameh Khamis 创建的 God's Eye View 项目_

</div>

