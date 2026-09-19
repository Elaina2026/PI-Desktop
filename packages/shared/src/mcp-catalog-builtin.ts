/**
 * The catalog that ships inside the app.
 *
 * It is the floor, not the ceiling: the market must be useful with the network
 * off and before any remote catalog exists, so every entry here is either
 * zero-config or asks for exactly one obvious value. Remote catalogs layer on
 * top later; this file stays the offline fallback.
 */
import type { McpCatalogFile } from "./mcp-catalog.js";

export const BUILTIN_MCP_CATALOG: McpCatalogFile = {
  "schemaVersion": 1,
  "updatedAt": "2026-09-19",
  "source": "builtin",
  "servers": [
    {
      "id": "memory",
      "name": "Memory",
      "description": "持久知识图谱,让会话之间记住实体与关系",
      "author": "modelcontextprotocol",
      "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/memory",
      "categories": [
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-memory"
      ],
      "notes": "首次运行由 npx 拉包,稍等片刻"
    },
    {
      "id": "sequential-thinking",
      "name": "Sequential Thinking",
      "description": "动态反思式分步推理,复杂问题拆解",
      "author": "modelcontextprotocol",
      "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking",
      "categories": [
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-sequential-thinking"
      ]
    },
    {
      "id": "everything",
      "name": "Everything",
      "description": "官方测试 server,覆盖全部 MCP 能力,用来验证接入是否正常",
      "author": "modelcontextprotocol",
      "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/everything",
      "categories": [
        "docs"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-everything"
      ]
    },
    {
      "id": "filesystem",
      "name": "Filesystem",
      "description": "在指定目录范围内读写文件、列目录、搜索",
      "author": "modelcontextprotocol",
      "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem",
      "categories": [
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "${MCP_FS_ROOT}"
      ],
      "requiredEnv": [
        {
          "name": "MCP_FS_ROOT",
          "description": "允许访问的根目录",
          "defaultValue": "."
        }
      ],
      "notes": "server 只能访问该目录之内的路径"
    },
    {
      "id": "playwright",
      "name": "Playwright",
      "description": "用可访问性树驱动浏览器:打开页面、点击、填表、截图",
      "author": "microsoft",
      "homepage": "https://github.com/microsoft/playwright-mcp",
      "categories": [
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@playwright/mcp@latest"
      ],
      "prerequisites": [
        "首次使用会提示安装浏览器内核"
      ]
    },
    {
      "id": "context7",
      "name": "Context7",
      "description": "随时查到各框架/库的最新版文档,避免模型凭旧记忆写代码",
      "author": "upstash",
      "homepage": "https://github.com/upstash/context7",
      "categories": [
        "docs"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@upstash/context7-mcp"
      ]
    },
    {
      "id": "fetch",
      "name": "Fetch",
      "description": "抓取网页并转成 Markdown 给模型阅读",
      "author": "modelcontextprotocol",
      "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/fetch",
      "categories": [
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-fetch"
      ]
    },
    {
      "id": "git",
      "name": "Git",
      "description": "读取仓库状态、diff、log,并执行常用 Git 操作",
      "author": "modelcontextprotocol",
      "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/git",
      "categories": [
        "devtools"
      ],
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-git"
      ]
    },
    {
      "id": "time",
      "name": "Time",
      "description": "查时区与时间换算",
      "author": "modelcontextprotocol",
      "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/time",
      "categories": [
        "productivity"
      ],
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-time"
      ]
    },
    {
      "id": "puppeteer",
      "name": "Puppeteer",
      "description": "网页自动化交互与内容提取",
      "author": "modelcontextprotocol",
      "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer",
      "categories": [
        "web",
        "devtools"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-puppeteer"
      ]
    },
    {
      "id": "deepwiki",
      "name": "DeepWiki",
      "description": "问任何 GitHub 仓库的架构与实现,仓库百科",
      "author": "devin",
      "homepage": "https://deepwiki.com",
      "categories": [
        "docs"
      ],
      "verified": true,
      "transport": "http",
      "url": "https://mcp.deepwiki.com/mcp"
    },
    {
      "id": "notion",
      "name": "Notion",
      "description": "搜索、读取、创建 Notion 页面与数据库",
      "author": "notion",
      "homepage": "https://developers.notion.com/docs/mcp",
      "categories": [
        "productivity"
      ],
      "verified": true,
      "transport": "http",
      "url": "https://mcp.notion.com/mcp",
      "notes": "首次连接需在浏览器完成 Notion 授权"
    },
    {
      "id": "exa",
      "name": "Exa",
      "description": "面向 AI 的网络搜索与网页内容获取",
      "author": "exa",
      "homepage": "https://docs.exa.ai/help/mcp",
      "categories": [
        "web"
      ],
      "verified": true,
      "transport": "http",
      "url": "https://mcp.exa.ai/mcp",
      "headers": {
        "x-api-key": "${EXA_API_KEY}"
      },
      "requiredEnv": [
        {
          "name": "EXA_API_KEY",
          "description": "Exa API Key (dashboard.exa.ai)"
        }
      ]
    },
    {
      "id": "github",
      "name": "GitHub",
      "description": "官方远程 MCP:仓库、issue、PR、Actions 操作",
      "author": "github",
      "homepage": "https://github.com/github/github-mcp-server",
      "categories": [
        "devtools"
      ],
      "verified": true,
      "transport": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${GITHUB_PAT}"
      },
      "requiredEnv": [
        {
          "name": "GITHUB_PAT",
          "description": "GitHub Personal Access Token"
        }
      ]
    },
    {
      "id": "brave-search",
      "name": "Brave Search",
      "description": "Brave 网络搜索",
      "author": "modelcontextprotocol",
      "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search",
      "categories": [
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-brave-search"
      ],
      "env": {
        "BRAVE_API_KEY": "${BRAVE_API_KEY}"
      },
      "requiredEnv": [
        {
          "name": "BRAVE_API_KEY",
          "description": "Brave Search API Key"
        }
      ]
    },
    {
      "id": "github-local",
      "name": "GitHub (CLI & Actions)",
      "description": "Quản lý repo, tự tạo repo, search code/issues/PRs, commit, push, tạo PR",
      "author": "modelcontextprotocol",
      "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/github",
      "categories": [
        "devtools"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "requiredEnv": [
        {
          "name": "GITHUB_PERSONAL_ACCESS_TOKEN",
          "description": "GitHub Personal Access Token (repo, workflow scopes)"
        }
      ]
    },
    {
      "id": "supabase",
      "name": "Supabase",
      "description": "Quản lý cơ sở dữ liệu Supabase, SQL query, Storage buckets, Edge functions và migrations",
      "author": "supabase",
      "homepage": "https://supabase.com/docs/guides/ai/mcp",
      "categories": [
        "data",
        "devtools"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "SUPABASE_URL",
          "description": "Supabase project URL (https://xyz.supabase.co)"
        },
        {
          "name": "SUPABASE_SERVICE_ROLE_KEY",
          "description": "Supabase Service Role Key / Access Token"
        }
      ]
    },
    {
      "id": "gmail",
      "name": "Google Gmail",
      "description": "Tìm kiếm, đọc, soạn thảo, và gửi email qua Gmail API",
      "author": "google",
      "homepage": "https://developers.google.com/gmail/api",
      "categories": [
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-gmail"
      ],
      "requiredEnv": [
        {
          "name": "GMAIL_TOKEN",
          "description": "Google OAuth Access Token / Refresh Token"
        }
      ]
    },
    {
      "id": "google-drive",
      "name": "Google Drive",
      "description": "Tìm kiếm, đọc tài liệu, tải xuống và tải lên tệp tin trên Google Drive",
      "author": "modelcontextprotocol",
      "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/gdrive",
      "categories": [
        "productivity",
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-gdrive"
      ],
      "requiredEnv": [
        {
          "name": "GDRIVE_TOKEN",
          "description": "Google OAuth Credentials / Access Token"
        }
      ]
    },
    {
      "id": "google-calendar",
      "name": "Google Calendar",
      "description": "Manage Google Calendar events, schedule meetings and check availability",
      "author": "google",
      "homepage": "https://developers.google.com/calendar",
      "categories": [
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-google-calendar"
      ],
      "requiredEnv": [
        {
          "name": "GOOGLE_CALENDAR_TOKEN",
          "description": "Google OAuth Access Token"
        }
      ]
    },
    {
      "id": "slack",
      "name": "Slack",
      "description": "Read channels, search messages, and manage communication in Slack",
      "author": "slack",
      "homepage": "https://api.slack.com",
      "categories": [
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-slack"
      ],
      "requiredEnv": [
        {
          "name": "SLACK_BOT_TOKEN",
          "description": "Slack Bot Token (xoxb-...)"
        }
      ]
    },
    {
      "id": "outlook-email",
      "name": "Outlook Email",
      "description": "Triage Outlook inboxes, read and send emails via Microsoft Graph",
      "author": "microsoft",
      "homepage": "https://developer.microsoft.com/en-us/graph",
      "categories": [
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@azure/mcp-outlook-mail"
      ],
      "requiredEnv": [
        {
          "name": "MS_GRAPH_TOKEN",
          "description": "Microsoft Graph Access Token"
        }
      ]
    },
    {
      "id": "granola",
      "name": "Granola",
      "description": "Add your meeting context, summarize notes and extract key actions",
      "author": "granola",
      "homepage": "https://granola.ai",
      "categories": [
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "granola-mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "GRANOLA_API_KEY",
          "description": "Granola API Key"
        }
      ]
    },
    {
      "id": "fireflies",
      "name": "Fireflies",
      "description": "Search meeting transcripts, audio summaries, and action items",
      "author": "fireflies",
      "homepage": "https://fireflies.ai",
      "categories": [
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "fireflies-ai-mcp"
      ],
      "requiredEnv": [
        {
          "name": "FIREFLIES_API_KEY",
          "description": "Fireflies API Key"
        }
      ]
    },
    {
      "id": "outlook-calendar",
      "name": "Outlook Calendar",
      "description": "Manage Outlook schedules, appointments, and room bookings",
      "author": "microsoft",
      "homepage": "https://developer.microsoft.com/en-us/graph",
      "categories": [
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@azure/mcp-outlook-calendar"
      ],
      "requiredEnv": [
        {
          "name": "MS_CALENDAR_TOKEN",
          "description": "Microsoft Graph Calendar Token"
        }
      ]
    },
    {
      "id": "plaud",
      "name": "Plaud",
      "description": "Retrieve insights, voice recordings, and transcriptions from Plaud",
      "author": "plaud",
      "homepage": "https://plaud.ai",
      "categories": [
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "plaud-note-mcp"
      ],
      "requiredEnv": [
        {
          "name": "PLAUD_API_KEY",
          "description": "Plaud API Key"
        }
      ]
    },
    {
      "id": "otter-ai",
      "name": "Otter.ai",
      "description": "Search meetings, real-time transcriptions, and automated meeting notes",
      "author": "otter",
      "homepage": "https://otter.ai",
      "categories": [
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "otter-ai-mcp"
      ],
      "requiredEnv": [
        {
          "name": "OTTER_API_KEY",
          "description": "Otter.ai API Token"
        }
      ]
    },
    {
      "id": "atlassian-rovo",
      "name": "Atlassian Rovo (Legacy)",
      "description": "Manage Jira issues, sprints, and Confluence documentation",
      "author": "atlassian",
      "homepage": "https://www.atlassian.com/software/rovo",
      "categories": [
        "productivity",
        "devtools"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@atlassian/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "ATLASSIAN_HOST",
          "description": "Your Atlassian domain (e.g. company.atlassian.net)"
        },
        {
          "name": "ATLASSIAN_API_TOKEN",
          "description": "Atlassian API Token"
        }
      ]
    },
    {
      "id": "linear",
      "name": "Linear",
      "description": "Streamline software projects, sprints, issues, and roadmap management",
      "author": "linear",
      "homepage": "https://linear.app",
      "categories": [
        "productivity",
        "devtools"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@linear/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "LINEAR_API_KEY",
          "description": "Linear Personal API Key"
        }
      ]
    },
    {
      "id": "monday",
      "name": "monday.com",
      "description": "Work OS boards, tasks, items, and workflow automation",
      "author": "monday",
      "homepage": "https://monday.com",
      "categories": [
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@mondaycom/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "MONDAY_API_TOKEN",
          "description": "monday.com API Token"
        }
      ]
    },
    {
      "id": "data-analytics",
      "name": "Data",
      "description": "Answer questions with data, run statistical models, and compute aggregations",
      "author": "openai",
      "homepage": "https://modelcontextprotocol.io",
      "categories": [
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-sqlite",
        "${DATABASE_PATH}"
      ],
      "requiredEnv": [
        {
          "name": "DATABASE_PATH",
          "description": "Path to SQLite data file",
          "defaultValue": ":memory:"
        }
      ]
    },
    {
      "id": "tableau",
      "name": "Tableau",
      "description": "See and understand data, query workbooks and dashboards via REST API",
      "author": "salesforce",
      "homepage": "https://www.tableau.com/developer",
      "categories": [
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@tableau/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "TABLEAU_SERVER_URL",
          "description": "Tableau Server or Cloud URL"
        },
        {
          "name": "TABLEAU_TOKEN_NAME",
          "description": "Personal Access Token Name"
        },
        {
          "name": "TABLEAU_TOKEN_SECRET",
          "description": "Personal Access Token Secret"
        }
      ]
    },
    {
      "id": "power-bi",
      "name": "Microsoft Power BI",
      "description": "Explore and author analytics in your browser and query Power BI semantic models",
      "author": "microsoft",
      "homepage": "https://powerbi.microsoft.com",
      "categories": [
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@powerbi/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "POWERBI_ACCESS_TOKEN",
          "description": "Power BI REST API Access Token"
        }
      ]
    },
    {
      "id": "aws-data-analytics",
      "name": "AWS Data Analytics",
      "description": "Query Athena, Redshift, Glue catalogs and cloud telemetry",
      "author": "amazon",
      "homepage": "https://aws.amazon.com/big-data/datalakes-and-analytics",
      "categories": [
        "data",
        "devtools"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@aws/mcp-data-analytics"
      ],
      "requiredEnv": [
        {
          "name": "AWS_ACCESS_KEY_ID",
          "description": "AWS Access Key ID"
        },
        {
          "name": "AWS_SECRET_ACCESS_KEY",
          "description": "AWS Secret Access Key"
        },
        {
          "name": "AWS_REGION",
          "description": "AWS Region (e.g. us-east-1)",
          "defaultValue": "us-east-1"
        }
      ]
    },
    {
      "id": "clickhouse",
      "name": "ClickHouse",
      "description": "Explore ClickHouse Cloud, real-time analytics, and column-oriented SQL",
      "author": "clickhouse",
      "homepage": "https://clickhouse.com",
      "categories": [
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@clickhouse/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "CLICKHOUSE_HOST",
          "description": "ClickHouse Host endpoint"
        },
        {
          "name": "CLICKHOUSE_USER",
          "description": "Username",
          "defaultValue": "default"
        },
        {
          "name": "CLICKHOUSE_PASSWORD",
          "description": "Password"
        }
      ]
    },
    {
      "id": "firebase",
      "name": "Firebase",
      "description": "Build and manage Firebase apps, Firestore collections, and Cloud Functions",
      "author": "google",
      "homepage": "https://firebase.google.com",
      "categories": [
        "devtools",
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@firebase/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "FIREBASE_SERVICE_ACCOUNT",
          "description": "JSON Service Account Key"
        }
      ]
    },
    {
      "id": "thoughtspot",
      "name": "ThoughtSpot Spotter",
      "description": "Search-driven analytics, live data queries, and automated pinboards",
      "author": "thoughtspot",
      "homepage": "https://www.thoughtspot.com",
      "categories": [
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "thoughtspot-mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "THOUGHTSPOT_HOST",
          "description": "ThoughtSpot instance URL"
        },
        {
          "name": "THOUGHTSPOT_TOKEN",
          "description": "Bearer Token"
        }
      ]
    },
    {
      "id": "sigma-computing",
      "name": "Sigma",
      "description": "Cloud analytics for spreadsheets, direct warehouse queries, and live workbooks",
      "author": "sigma",
      "homepage": "https://www.sigmacomputing.com",
      "categories": [
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "sigma-computing-mcp"
      ],
      "requiredEnv": [
        {
          "name": "SIGMA_API_TOKEN",
          "description": "Sigma API Client Token"
        }
      ]
    },
    {
      "id": "posthog",
      "name": "PostHog",
      "description": "Analyze your product data, session recordings, feature flags, and events",
      "author": "posthog",
      "homepage": "https://posthog.com",
      "categories": [
        "data",
        "devtools"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@posthog/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "POSTHOG_API_KEY",
          "description": "PostHog Personal API Key"
        },
        {
          "name": "POSTHOG_HOST",
          "description": "PostHog Host (https://app.posthog.com)",
          "defaultValue": "https://app.posthog.com"
        }
      ]
    },
    {
      "id": "amplitude",
      "name": "Amplitude",
      "description": "Analyze your product data, user conversion funnels, and retention metrics",
      "author": "amplitude",
      "homepage": "https://amplitude.com",
      "categories": [
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "amplitude-mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "AMPLITUDE_API_KEY",
          "description": "Amplitude API Key"
        },
        {
          "name": "AMPLITUDE_SECRET_KEY",
          "description": "Amplitude Secret Key"
        }
      ]
    },
    {
      "id": "mixpanel",
      "name": "Mixpanel",
      "description": "Query and analyze Mixpanel event cohorts, funnels, and retention",
      "author": "mixpanel",
      "homepage": "https://mixpanel.com",
      "categories": [
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "mixpanel-mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "MIXPANEL_PROJECT_ID",
          "description": "Mixpanel Project ID"
        },
        {
          "name": "MIXPANEL_SERVICE_SECRET",
          "description": "Service Account Secret"
        }
      ]
    },
    {
      "id": "bigquery",
      "name": "BigQuery",
      "description": "Query and manage Google BigQuery datasets, tables, and jobs",
      "author": "google",
      "homepage": "https://cloud.google.com/bigquery",
      "categories": [
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@google-cloud/bigquery-mcp"
      ],
      "requiredEnv": [
        {
          "name": "GOOGLE_APPLICATION_CREDENTIALS",
          "description": "Service Account JSON file path"
        },
        {
          "name": "BIGQUERY_PROJECT_ID",
          "description": "GCP Project ID"
        }
      ]
    },
    {
      "id": "motherduck",
      "name": "MotherDuck",
      "description": "Get answers from your data using serverless DuckDB analytics",
      "author": "motherduck",
      "homepage": "https://motherduck.com",
      "categories": [
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@motherduck/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "MOTHERDUCK_TOKEN",
          "description": "MotherDuck Access Token"
        }
      ]
    },
    {
      "id": "coupler-io",
      "name": "Coupler.io",
      "description": "Automate data integrations and sync marketing metrics across platforms",
      "author": "coupler",
      "homepage": "https://www.coupler.io",
      "categories": [
        "data",
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "coupler-io-mcp"
      ],
      "requiredEnv": [
        {
          "name": "COUPLER_API_KEY",
          "description": "Coupler.io API Key"
        }
      ]
    },
    {
      "id": "hex-data",
      "name": "Hex",
      "description": "Collaborative data science, SQL, python notebooks, and interactive apps",
      "author": "hex",
      "homepage": "https://hex.tech",
      "categories": [
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "hex-data-mcp"
      ],
      "requiredEnv": [
        {
          "name": "HEX_API_TOKEN",
          "description": "Hex Personal Access Token"
        }
      ]
    },
    {
      "id": "dropbox",
      "name": "Dropbox",
      "description": "Find, create, and take action on files across your Dropbox storage",
      "author": "dropbox",
      "homepage": "https://www.dropbox.com/developers",
      "categories": [
        "productivity",
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@dropbox/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "DROPBOX_ACCESS_TOKEN",
          "description": "Dropbox OAuth Access Token"
        }
      ]
    },
    {
      "id": "hubspot",
      "name": "HubSpot",
      "description": "Insights to action in HubSpot: manage contacts, deals, and pipelines",
      "author": "hubspot",
      "homepage": "https://developers.hubspot.com",
      "categories": [
        "productivity",
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@hubspot/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "HUBSPOT_ACCESS_TOKEN",
          "description": "HubSpot Private App Access Token"
        }
      ]
    },
    {
      "id": "stripe",
      "name": "Stripe",
      "description": "Accept payments, manage customers, subscriptions, and financial data",
      "author": "stripe",
      "homepage": "https://stripe.com/docs/api",
      "categories": [
        "productivity",
        "devtools"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@stripe/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "STRIPE_SECRET_KEY",
          "description": "Stripe Secret API Key (sk_...)"
        }
      ]
    },
    {
      "id": "shopify",
      "name": "Shopify",
      "description": "Create and manage your store, inventory, orders, and products",
      "author": "shopify",
      "homepage": "https://shopify.dev",
      "categories": [
        "productivity",
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@shopify/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "SHOPIFY_STORE_DOMAIN",
          "description": "Your shop domain (e.g. your-store.myshopify.com)"
        },
        {
          "name": "SHOPIFY_ADMIN_TOKEN",
          "description": "Shopify Admin API Access Token"
        }
      ]
    },
    {
      "id": "wix",
      "name": "Wix",
      "description": "Manage Wix websites, online stores, bookings, and customer databases",
      "author": "wix",
      "homepage": "https://dev.wix.com",
      "categories": [
        "productivity",
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@wix/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "WIX_API_KEY",
          "description": "Wix API Key"
        }
      ]
    },
    {
      "id": "zoho-crm",
      "name": "Zoho CRM",
      "description": "Automate Sales Operations, manage leads, accounts, and deal stages",
      "author": "zoho",
      "homepage": "https://www.zoho.com/crm/developer",
      "categories": [
        "productivity",
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "zoho-crm-mcp"
      ],
      "requiredEnv": [
        {
          "name": "ZOHO_CLIENT_ID",
          "description": "Zoho Client ID"
        },
        {
          "name": "ZOHO_CLIENT_SECRET",
          "description": "Zoho Client Secret"
        }
      ]
    },
    {
      "id": "apollo-io",
      "name": "Apollo.io",
      "description": "Find buyers and close deals with verified B2B contact and company data",
      "author": "apollo",
      "homepage": "https://www.apollo.io",
      "categories": [
        "productivity",
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "apollo-io-mcp"
      ],
      "requiredEnv": [
        {
          "name": "APOLLO_API_KEY",
          "description": "Apollo.io API Key"
        }
      ]
    },
    {
      "id": "webflow",
      "name": "Webflow",
      "description": "Manage Webflow sites, CMS items, publishing, and custom design code",
      "author": "webflow",
      "homepage": "https://developers.webflow.com",
      "categories": [
        "productivity",
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@webflow/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "WEBFLOW_API_TOKEN",
          "description": "Webflow Site API Token"
        }
      ]
    },
    {
      "id": "zoominfo",
      "name": "ZoomInfo",
      "description": "B2B data and GTM insights, org charts, and lead intelligence",
      "author": "zoominfo",
      "homepage": "https://www.zoominfo.com",
      "categories": [
        "data",
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "zoominfo-mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "ZOOMINFO_USERNAME",
          "description": "ZoomInfo Account Email"
        },
        {
          "name": "ZOOMINFO_CLIENT_ID",
          "description": "ZoomInfo Client ID"
        }
      ]
    },
    {
      "id": "attio",
      "name": "Attio",
      "description": "Next-generation CRM for modern tech companies and automated pipelines",
      "author": "attio",
      "homepage": "https://attio.com",
      "categories": [
        "productivity",
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@attio/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "ATTIO_API_KEY",
          "description": "Attio Access Token"
        }
      ]
    },
    {
      "id": "ahrefs",
      "name": "Ahrefs",
      "description": "SEO analysis, backlink research, keyword exploration, and site audits",
      "author": "ahrefs",
      "homepage": "https://ahrefs.com/api",
      "categories": [
        "web",
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "ahrefs-mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "AHREFS_API_KEY",
          "description": "Ahrefs API Key"
        }
      ]
    },
    {
      "id": "canva",
      "name": "Canva",
      "description": "Create, review, edit designs, presentations, and visual branding assets",
      "author": "canva",
      "homepage": "https://www.canva.dev",
      "categories": [
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@canva/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "CANVA_API_KEY",
          "description": "Canva Connect API Key"
        }
      ]
    },
    {
      "id": "figma",
      "name": "Figma",
      "description": "Inspect component styles, extract design tokens, and ship UI designs to code",
      "author": "figma",
      "homepage": "https://www.figma.com/developers/api",
      "categories": [
        "productivity",
        "devtools"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@figma/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "FIGMA_ACCESS_TOKEN",
          "description": "Figma Personal Access Token"
        }
      ]
    },
    {
      "id": "higgsfield",
      "name": "Higgsfield",
      "description": "Generate and edit images and video models with cinematic control",
      "author": "higgsfield",
      "homepage": "https://higgsfield.ai",
      "categories": [
        "productivity",
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "higgsfield-mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "HIGGSFIELD_API_KEY",
          "description": "Higgsfield API Key"
        }
      ]
    },
    {
      "id": "product-design",
      "name": "Product Design",
      "description": "Explore and prototype UI/UX ideas, wireframes, and design components",
      "author": "openai",
      "homepage": "https://modelcontextprotocol.io",
      "categories": [
        "productivity",
        "devtools"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "product-design-mcp"
      ]
    },
    {
      "id": "magnific",
      "name": "Magnific",
      "description": "High-resolution image upscaling, enhancement, and generative transformations",
      "author": "magnific",
      "homepage": "https://magnific.ai",
      "categories": [
        "productivity",
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "magnific-ai-mcp"
      ],
      "requiredEnv": [
        {
          "name": "MAGNIFIC_API_KEY",
          "description": "Magnific AI Key"
        }
      ]
    },
    {
      "id": "heygen",
      "name": "HeyGen",
      "description": "Create AI studio videos, custom avatars, and voice synthesizers",
      "author": "heygen",
      "homepage": "https://www.heygen.com",
      "categories": [
        "productivity",
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@heygen/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "HEYGEN_API_KEY",
          "description": "HeyGen API Key"
        }
      ]
    },
    {
      "id": "mobbin",
      "name": "Mobbin",
      "description": "Browse comprehensive mobile and web UI design patterns and screen references",
      "author": "mobbin",
      "homepage": "https://mobbin.com",
      "categories": [
        "productivity",
        "docs"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "mobbin-mcp-server"
      ]
    },
    {
      "id": "runway",
      "name": "Runway",
      "description": "Generative video synthesis, Gen-3 text-to-video, and creative media editing",
      "author": "runway",
      "homepage": "https://runwayml.com",
      "categories": [
        "productivity",
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@runwayml/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "RUNWAYML_API_SECRET",
          "description": "Runway API Secret Key"
        }
      ]
    },
    {
      "id": "datadog",
      "name": "Datadog",
      "description": "Query and visualize metrics, APM traces, synthetic monitors, and logs",
      "author": "datadog",
      "homepage": "https://www.datadoghq.com",
      "categories": [
        "data",
        "devtools"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@datadog/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "DATADOG_API_KEY",
          "description": "Datadog API Key"
        },
        {
          "name": "DATADOG_APP_KEY",
          "description": "Datadog Application Key"
        }
      ]
    },
    {
      "id": "vercel",
      "name": "Vercel",
      "description": "Build and deploy web apps, inspect deployments, manage edge domains and env vars",
      "author": "vercel",
      "homepage": "https://vercel.com/docs/rest-api",
      "categories": [
        "devtools",
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@vercel/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "VERCEL_TOKEN",
          "description": "Vercel Personal Access Token"
        }
      ]
    },
    {
      "id": "neon",
      "name": "Neon",
      "description": "Manage serverless Postgres databases, branching, autoscaling, and compute endpoints",
      "author": "neondatabase",
      "homepage": "https://neon.tech",
      "categories": [
        "data",
        "devtools"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@neondatabase/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "NEON_API_KEY",
          "description": "Neon API Key"
        }
      ]
    },
    {
      "id": "devpost",
      "name": "Devpost Hackathons",
      "description": "Find, inspect, and submit projects to global developer hackathons",
      "author": "devpost",
      "homepage": "https://devpost.com",
      "categories": [
        "devtools",
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "devpost-hackathons-mcp"
      ]
    },
    {
      "id": "base44",
      "name": "Base44",
      "description": "Deploy and manage modular backend services and API abstractions",
      "author": "base44",
      "homepage": "https://base44.com",
      "categories": [
        "devtools"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "base44-mcp-server"
      ]
    },
    {
      "id": "superhuman",
      "name": "Superhuman Mail",
      "description": "Fast email triage, keyboard-first inbox management, and calendar assist",
      "author": "superhuman",
      "homepage": "https://superhuman.com",
      "categories": [
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "superhuman-mail-mcp"
      ],
      "requiredEnv": [
        {
          "name": "SUPERHUMAN_API_KEY",
          "description": "Superhuman Access Token"
        }
      ]
    },
    {
      "id": "microsoft-teams",
      "name": "Teams",
      "description": "Summarize Teams messages, search team chats, and manage follow-ups",
      "author": "microsoft",
      "homepage": "https://developer.microsoft.com/en-us/microsoft-teams",
      "categories": [
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@azure/mcp-teams"
      ],
      "requiredEnv": [
        {
          "name": "TEAMS_AUTH_TOKEN",
          "description": "Microsoft Teams OAuth Token"
        }
      ]
    },
    {
      "id": "zoom",
      "name": "Zoom",
      "description": "Smart meeting insights, schedule video calls, and query Zoom meeting cloud records",
      "author": "zoom",
      "homepage": "https://developers.zoom.us",
      "categories": [
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@zoom/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "ZOOM_ACCOUNT_ID",
          "description": "Zoom Account ID"
        },
        {
          "name": "ZOOM_CLIENT_ID",
          "description": "Zoom Client ID"
        },
        {
          "name": "ZOOM_CLIENT_SECRET",
          "description": "Zoom Client Secret"
        }
      ]
    },
    {
      "id": "hostinger-mail",
      "name": "Hostinger Mail",
      "description": "Manage domain mailboxes, forwarders, and send authenticated SMTP/IMAP emails",
      "author": "hostinger",
      "homepage": "https://www.hostinger.com",
      "categories": [
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "hostinger-mail-mcp"
      ],
      "requiredEnv": [
        {
          "name": "HOSTINGER_EMAIL",
          "description": "Email address"
        },
        {
          "name": "HOSTINGER_PASSWORD",
          "description": "Email password"
        }
      ]
    },
    {
      "id": "mailopoly",
      "name": "Mailopoly Inbox",
      "description": "Search, send emails & transactional messages across disposable and team inboxes",
      "author": "mailopoly",
      "homepage": "https://mailopoly.com",
      "categories": [
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "mailopoly-inbox-mcp"
      ],
      "requiredEnv": [
        {
          "name": "MAILOPOLY_API_KEY",
          "description": "Mailopoly API Key"
        }
      ]
    },
    {
      "id": "geekbot",
      "name": "Geekbot",
      "description": "Run asynchronous standups, sprint retrospectives, and surveys across teams",
      "author": "geekbot",
      "homepage": "https://geekbot.com",
      "categories": [
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@geekbot/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "GEEKBOT_API_TOKEN",
          "description": "Geekbot API Token"
        }
      ]
    },
    {
      "id": "speko",
      "name": "Speko",
      "description": "Voice-driven team communication and real-time audio transcripts",
      "author": "speko",
      "homepage": "https://speko.ai",
      "categories": [
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "speko-voice-mcp"
      ]
    },
    {
      "id": "readwise",
      "name": "Readwise",
      "description": "Save, read, search, and learn from Kindle highlights, articles, and Reader docs",
      "author": "readwise",
      "homepage": "https://readwise.io/api_deets",
      "categories": [
        "docs",
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@readwise/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "READWISE_ACCESS_TOKEN",
          "description": "Readwise Access Token"
        }
      ]
    },
    {
      "id": "acumen",
      "name": "Acumen by Talarion",
      "description": "Keep your AI up to date with live knowledge, technical papers, and industry feeds",
      "author": "talarion",
      "homepage": "https://talarion.ai",
      "categories": [
        "docs",
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "acumen-mcp-server"
      ]
    },
    {
      "id": "consensus",
      "name": "Consensus",
      "description": "Explore scientific research papers and query peer-reviewed evidence",
      "author": "consensus",
      "homepage": "https://consensus.app",
      "categories": [
        "docs",
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@consensus/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "CONSENSUS_API_KEY",
          "description": "Consensus API Key"
        }
      ]
    },
    {
      "id": "sider-scholar",
      "name": "Sider Scholar",
      "description": "Search 350M+ research papers, save citations, and chat with literature",
      "author": "sider",
      "homepage": "https://sider.ai",
      "categories": [
        "docs",
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "sider-scholar-mcp"
      ]
    },
    {
      "id": "elicit",
      "name": "Elicit",
      "description": "Search scientific literature, automate systematic reviews, and extract data",
      "author": "elicit",
      "homepage": "https://elicit.com",
      "categories": [
        "docs",
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@elicit/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "ELICIT_API_KEY",
          "description": "Elicit API Token"
        }
      ]
    },
    {
      "id": "scispace",
      "name": "SciSpace",
      "description": "For science and research: simplify complex academic papers, equations, and tables",
      "author": "scispace",
      "homepage": "https://scispace.com",
      "categories": [
        "docs",
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "scispace-mcp-server"
      ]
    },
    {
      "id": "academic-writing",
      "name": "Academic Writing Toolkit",
      "description": "Format citations, check academic prose style, and structure scientific manuscripts",
      "author": "academic",
      "homepage": "https://modelcontextprotocol.io",
      "categories": [
        "docs",
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "academic-writing-mcp"
      ]
    },
    {
      "id": "scite",
      "name": "Scite",
      "description": "Smart Citations: verify whether research claims are supported or contrasted",
      "author": "scite",
      "homepage": "https://scite.ai",
      "categories": [
        "docs",
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@scite/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "SCITE_API_KEY",
          "description": "Scite API Key"
        }
      ]
    },
    {
      "id": "inductive",
      "name": "Inductive",
      "description": "State-of-the-art ADMET models, molecular properties, and pharmacology queries",
      "author": "inductive",
      "homepage": "https://inductive.bio",
      "categories": [
        "docs",
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "inductive-bio-mcp"
      ]
    },
    {
      "id": "slide-viewer",
      "name": "Slide Viewer",
      "description": "Explore whole-slide microscopy, digital pathology scans, and gigapixel imaging",
      "author": "microscopy",
      "homepage": "https://modelcontextprotocol.io",
      "categories": [
        "docs",
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "slide-viewer-mcp"
      ]
    },
    {
      "id": "biohub-esm",
      "name": "Biohub ESM",
      "description": "Understand proteins with ESM evolutionary scale models and embeddings",
      "author": "czbiohub",
      "homepage": "https://www.czbiohub.org",
      "categories": [
        "docs",
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "biohub-esm-mcp"
      ]
    },
    {
      "id": "seq2music",
      "name": "Seq2Music",
      "description": "Convert biological protein and DNA sequences to algorithmic musical audio",
      "author": "bioaudio",
      "homepage": "https://modelcontextprotocol.io",
      "categories": [
        "productivity",
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "seq2music-mcp"
      ]
    },
    {
      "id": "rosalind-workbench",
      "name": "Rosalind Workbench",
      "description": "Explore life-science workflows, bioinformatic algorithms, and genomic pipelines",
      "author": "rosalind",
      "homepage": "https://rosalind.info",
      "categories": [
        "docs",
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "rosalind-workbench-mcp"
      ]
    },
    {
      "id": "undermind",
      "name": "Undermind",
      "description": "Deep AI search to find and read highly specific scientific research papers",
      "author": "undermind",
      "homepage": "https://www.undermind.ai",
      "categories": [
        "docs",
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "undermind-science-mcp"
      ]
    },
    {
      "id": "genomic-intelligence",
      "name": "Genomic Intelligence",
      "description": "Analyze genomic variants, DNA markers, and transcriptomic data",
      "author": "genomics",
      "homepage": "https://modelcontextprotocol.io",
      "categories": [
        "docs",
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "genomic-intelligence-mcp"
      ]
    },
    {
      "id": "molecular-structure-viewer",
      "name": "Molecular Structure Viewer",
      "description": "3D visualization and PDB inspection of chemical molecules and macromolecular complexes",
      "author": "structural-bio",
      "homepage": "https://www.rcsb.org",
      "categories": [
        "docs",
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "molecular-viewer-mcp"
      ]
    },
    {
      "id": "codex-security",
      "name": "Codex Security",
      "description": "Security scanning for your codebase, AST vulnerability audits, and CVE detection",
      "author": "openai",
      "homepage": "https://modelcontextprotocol.io",
      "categories": [
        "devtools"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-security-scan"
      ]
    },
    {
      "id": "malwarebytes",
      "name": "Malwarebytes",
      "description": "Verify links, domains, IPs, file hashes, and threat intelligence",
      "author": "malwarebytes",
      "homepage": "https://www.malwarebytes.com",
      "categories": [
        "devtools",
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@malwarebytes/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "MALWAREBYTES_API_KEY",
          "description": "Malwarebytes Threat Intel API Key"
        }
      ]
    },
    {
      "id": "certscore",
      "name": "CertScore.ai Privacy Scanner",
      "description": "GDPR, cookies & trackers audit, privacy policy compliance verification",
      "author": "certscore",
      "homepage": "https://certscore.ai",
      "categories": [
        "devtools",
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "certscore-privacy-mcp"
      ]
    },
    {
      "id": "aivana-security",
      "name": "Aivana Security Investigator",
      "description": "Run safe KQL investigations, query security alerts, and analyze SOC incidents",
      "author": "aivana",
      "homepage": "https://aivana.ai",
      "categories": [
        "devtools",
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "aivana-security-mcp"
      ]
    },
    {
      "id": "ai-know-me",
      "name": "AI Know Me",
      "description": "安全调用网站、系统与服务凭据,自动管理安全凭据生命周期",
      "author": "aiknowme",
      "homepage": "https://aiknowme.com",
      "categories": [
        "devtools",
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "ai-know-me-mcp"
      ]
    },
    {
      "id": "above-security",
      "name": "Above Security",
      "description": "Investigate insider threats, anomalous access patterns, and cloud security postures",
      "author": "abovesecurity",
      "homepage": "https://abovesecurity.com",
      "categories": [
        "devtools",
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "above-security-mcp"
      ]
    },
    {
      "id": "tahr-security",
      "name": "Tahr Security",
      "description": "Cloud identity security, IAM posture analysis, and privilege audit",
      "author": "tahr",
      "homepage": "https://tahrsecurity.com",
      "categories": [
        "devtools"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "tahr-security-mcp"
      ]
    },
    {
      "id": "mcp-precheck",
      "name": "MCP Precheck",
      "description": "Pre-flight validation for MCP transports, schema enforcement, and tool sanitization",
      "author": "mcpprecheck",
      "homepage": "https://modelcontextprotocol.io",
      "categories": [
        "devtools"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "mcp-precheck-tool"
      ]
    },
    {
      "id": "longbridge",
      "name": "Longbridge",
      "description": "Stock quotes, financial data, real-time Level 2 market data, and order routing",
      "author": "longbridge",
      "homepage": "https://open.longbridgeapp.com",
      "categories": [
        "data",
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@longbridge/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "LONGBRIDGE_APP_KEY",
          "description": "App Key"
        },
        {
          "name": "LONGBRIDGE_ACCESS_TOKEN",
          "description": "Access Token"
        }
      ]
    },
    {
      "id": "interactive-brokers",
      "name": "Interactive Brokers (IBKR)",
      "description": "Analyze global markets, portfolio holdings, quotes, and execution orders via Client Portal API",
      "author": "ibkr",
      "homepage": "https://www.interactivebrokers.com",
      "categories": [
        "data",
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "ibkr-mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "IBKR_GATEWAY_URL",
          "description": "Local Client Portal Gateway URL (https://localhost:5000)"
        }
      ]
    },
    {
      "id": "public-equity",
      "name": "Public Equity Investing",
      "description": "Public equity research, SEC EDGAR 10-K/10-Q filing queries, and financial ratios",
      "author": "equity",
      "homepage": "https://modelcontextprotocol.io",
      "categories": [
        "data",
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "public-equity-mcp"
      ]
    },
    {
      "id": "quartr",
      "name": "Quartr",
      "description": "Company research data, earnings call transcripts, investor slide decks, and consensus",
      "author": "quartr",
      "homepage": "https://quartr.com",
      "categories": [
        "data",
        "docs"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@quartr/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "QUARTR_API_KEY",
          "description": "Quartr API Key"
        }
      ]
    },
    {
      "id": "alpaca",
      "name": "Alpaca",
      "description": "Market data: stocks & crypto, real-time bars, trade execution, and paper trading",
      "author": "alpacamarkets",
      "homepage": "https://alpaca.markets",
      "categories": [
        "data",
        "devtools"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@alpacamarkets/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "APCA_API_KEY_ID",
          "description": "Alpaca API Key ID"
        },
        {
          "name": "APCA_API_SECRET_KEY",
          "description": "Alpaca Secret Key"
        }
      ]
    },
    {
      "id": "binance",
      "name": "Binance",
      "description": "Explore Binance market data, order books, candlestick charts, and tickers",
      "author": "binance",
      "homepage": "https://binance.com",
      "categories": [
        "data",
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "binance-market-mcp"
      ]
    },
    {
      "id": "pitchbook",
      "name": "PitchBook",
      "description": "Venture capital, private equity, valuations, and M&A transaction intelligence",
      "author": "pitchbook",
      "homepage": "https://pitchbook.com",
      "categories": [
        "data",
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@pitchbook/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "PITCHBOOK_API_KEY",
          "description": "PitchBook API Key"
        }
      ]
    },
    {
      "id": "apple-health",
      "name": "Health",
      "description": "Explore your personal health metrics, sleep stages, activity, and vital signs",
      "author": "apple",
      "homepage": "https://www.apple.com/ios/health",
      "categories": [
        "data",
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "apple-health-mcp"
      ]
    },
    {
      "id": "fitness-ai",
      "name": "Fitness AI Connector",
      "description": "AI coach for your Garmin and fitness wearables data, recovery and VO2 max",
      "author": "fitnessai",
      "homepage": "https://modelcontextprotocol.io",
      "categories": [
        "data",
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "fitness-ai-connector-mcp"
      ],
      "requiredEnv": [
        {
          "name": "FITNESS_AI_TOKEN",
          "description": "Wearable Sync Token"
        }
      ]
    },
    {
      "id": "coros",
      "name": "COROS",
      "description": "Workout data insights, training load, GPS tracks, and marathon plans",
      "author": "coros",
      "homepage": "https://www.coros.com",
      "categories": [
        "data",
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "coros-training-mcp"
      ]
    },
    {
      "id": "tredict",
      "name": "Tredict",
      "description": "Analyze endurance workouts, physiological curves, and create structured training plans",
      "author": "tredict",
      "homepage": "https://www.tredict.com",
      "categories": [
        "data",
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "tredict-training-mcp"
      ],
      "requiredEnv": [
        {
          "name": "TREDICT_API_TOKEN",
          "description": "Tredict Access Token"
        }
      ]
    },
    {
      "id": "skyscanner",
      "name": "Skyscanner",
      "description": "Find cheap flights, compare route prices, and track airline fare changes",
      "author": "skyscanner",
      "homepage": "https://www.skyscanner.net",
      "categories": [
        "web",
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "skyscanner-flight-mcp"
      ],
      "requiredEnv": [
        {
          "name": "SKYSCANNER_API_KEY",
          "description": "Skyscanner API Key"
        }
      ]
    },
    {
      "id": "trip-com",
      "name": "Trip.com",
      "description": "All-in-one Travel Companion: hotels, train tickets, flights, and travel attractions",
      "author": "tripcom",
      "homepage": "https://www.trip.com",
      "categories": [
        "web",
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "trip-com-travel-mcp"
      ]
    },
    {
      "id": "flight-network",
      "name": "Flight Network",
      "description": "Search and book flights, compare international carriers and seat availability",
      "author": "flightnetwork",
      "homepage": "https://www.flightnetwork.com",
      "categories": [
        "web",
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "flight-network-mcp"
      ]
    },
    {
      "id": "edreams",
      "name": "eDreams",
      "description": "Find flights, hotels, vacation packages, and rental cars worldwide",
      "author": "edreams",
      "homepage": "https://www.edreams.com",
      "categories": [
        "web",
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "edreams-travel-mcp"
      ]
    },
    {
      "id": "wikiloc",
      "name": "Wikiloc",
      "description": "Your perfect trail. Just ask: hiking, cycling, running, and outdoor GPS trails",
      "author": "wikiloc",
      "homepage": "https://www.wikiloc.com",
      "categories": [
        "web",
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "wikiloc-trails-mcp"
      ]
    },
    {
      "id": "komoot",
      "name": "komoot",
      "description": "Find outdoor sport routes, topographical elevation maps, and cycling tours",
      "author": "komoot",
      "homepage": "https://www.komoot.com",
      "categories": [
        "web",
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "komoot-routes-mcp"
      ]
    },
    {
      "id": "foreflight",
      "name": "ForeFlight Mobile",
      "description": "Aviation weather reports, METAR/TAF, aeronautical charts, and flight plans",
      "author": "foreflight",
      "homepage": "https://foreflight.com",
      "categories": [
        "web",
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "foreflight-aviation-mcp"
      ]
    },
    {
      "id": "trivago",
      "name": "trivago",
      "description": "Compare hotel rates across hundreds of booking platforms and reviews",
      "author": "trivago",
      "homepage": "https://www.trivago.com",
      "categories": [
        "web",
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "trivago-hotel-mcp"
      ]
    },
    {
      "id": "apple-music",
      "name": "Apple Music",
      "description": "Build playlists, find music tracks, search artists and stream audio previews",
      "author": "apple",
      "homepage": "https://developer.apple.com/musickit",
      "categories": [
        "productivity",
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "apple-music-mcp"
      ],
      "requiredEnv": [
        {
          "name": "APPLE_MUSIC_DEV_TOKEN",
          "description": "Apple Music Developer JWT Token"
        }
      ]
    },
    {
      "id": "podcast-app",
      "name": "Podcast App",
      "description": "Find great podcasts, episode transcripts, and RSS show feeds",
      "author": "podcasts",
      "homepage": "https://modelcontextprotocol.io",
      "categories": [
        "productivity",
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "podcast-index-mcp"
      ]
    },
    {
      "id": "chessy",
      "name": "Chessy",
      "description": "Play Chess Against ChatGPT, evaluate FEN board states, and calculate tactics",
      "author": "chessy",
      "homepage": "https://modelcontextprotocol.io",
      "categories": [
        "productivity",
        "devtools"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@chess/mcp-server"
      ]
    },
    {
      "id": "shazam",
      "name": "Shazam",
      "description": "Identify songs instantly from audio fragments and inspect track metadata",
      "author": "apple",
      "homepage": "https://www.shazam.com",
      "categories": [
        "web",
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "shazam-recognition-mcp"
      ]
    },
    {
      "id": "flixor",
      "name": "Flixor",
      "description": "Movie & TV Recommender: discover trending cinema, streaming availability, and ratings",
      "author": "flixor",
      "homepage": "https://www.themoviedb.org",
      "categories": [
        "web",
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "tmdb-movies-mcp"
      ],
      "requiredEnv": [
        {
          "name": "TMDB_API_KEY",
          "description": "The Movie Database (TMDB) API Key"
        }
      ]
    },
    {
      "id": "smart-chess",
      "name": "Smart Chess:Train+Learn to win",
      "description": "Play+improve: coach+strategy, Stockfish move evaluation and opening repertoire",
      "author": "smartchess",
      "homepage": "https://stockfishchess.org",
      "categories": [
        "productivity",
        "devtools"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "stockfish-chess-mcp"
      ]
    },
    {
      "id": "spotify",
      "name": "Spotify",
      "description": "Control playback, browse playlists, recommendations, and audio features",
      "author": "spotify",
      "homepage": "https://developer.spotify.com",
      "categories": [
        "web",
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@spotify/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "SPOTIFY_CLIENT_ID",
          "description": "Spotify Client ID"
        },
        {
          "name": "SPOTIFY_CLIENT_SECRET",
          "description": "Spotify Client Secret"
        }
      ]
    },
    {
      "id": "background-music",
      "name": "Background Music",
      "description": "Stream ambient soundscapes, lo-fi study beats, and focus background audio",
      "author": "ambient",
      "homepage": "https://modelcontextprotocol.io",
      "categories": [
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "ambient-sound-mcp"
      ]
    },
    {
      "id": "indeed",
      "name": "Indeed",
      "description": "Find jobs tailored for you, search career openings, salaries, and company reviews",
      "author": "indeed",
      "homepage": "https://www.indeed.com",
      "categories": [
        "web",
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "indeed-jobs-mcp"
      ]
    },
    {
      "id": "linkedin",
      "name": "LinkedIn",
      "description": "Find the right professional, query professional profiles, company updates, and talent networks",
      "author": "microsoft",
      "homepage": "https://developer.linkedin.com",
      "categories": [
        "web",
        "productivity"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@linkedin/mcp-server"
      ],
      "requiredEnv": [
        {
          "name": "LINKEDIN_OAUTH_TOKEN",
          "description": "LinkedIn OAuth Access Token"
        }
      ]
    },
    {
      "id": "tarot",
      "name": "Tarot",
      "description": "Tarot Reading & Divination: draw symbolic cards and interpret esoteric archetypes",
      "author": "divination",
      "homepage": "https://modelcontextprotocol.io",
      "categories": [
        "productivity",
        "web"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "tarot-reading-mcp"
      ]
    },
    {
      "id": "idealista",
      "name": "idealista",
      "description": "Find properties to buy or rent, explore real-estate listings and housing prices",
      "author": "idealista",
      "homepage": "https://www.idealista.com",
      "categories": [
        "web",
        "data"
      ],
      "verified": true,
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "idealista-realestate-mcp"
      ]
    }
  ]
};
