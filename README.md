# gitMergeBranchTo

在以往的开发过程，当我们开发完一个功能之后，想提测给用户，那么需要进行以下操作。

``` javascript
// 分支操作
1. checkout 到我们要提测的分支。一般是 develop
2. 拉取提测分支远端的代码。
3. 将本地的代码合并到提测分支。
4. 推送提测分支到远端。

// 部署
1. 切换到浏览器
2. 打开流水线
3. 找到我们对应环境和项目的流水线
4. 点击运行流水线
5. 点击确认
6. 切换回 IDE
```

这个过程带来了主要几个问题：

1. 需要执行多次git操作
2. 执行git 操作后会破坏本地代码的热更新，需要重跑项目。
3. 需要切换到浏览器操作运行流水线，再切回。

整个过程的体验比较繁琐，大多是重复性的操作。本插件的主要功能就是在IDE内直接一键执行上述操作，简化提测过程。

## 插件功能

1. 合并代码到指定的分支并推送到远端，而无需切换当前分支。
2. 通过webhook触发流水线的自动构建，无需切换到浏览器（打断编码的感觉真的很不好）

## 插件维护

草上飞

## 插件配置描述

``` json
{
  // 配置需要合并到哪些分支
  "gitMergeBranchTo.branches": [
    "develop",
    "uat"
  ]
  // 配置分支合并后的流水线触发配置。没有可不填
  "gitMergeBranchTo.deployConfig": {
    "projectList": ["monkey-cms-web-new", "monkey-saas-enterprise-web", "monkey-saas-web"], // 没用。跟 webstorm 的配置保持一致
    "urlConfig": [ // 流水线的 url 配置列表
      {
        "env": "dev", // 环境
        "defaultBranch": "develop", // 流水线的默认部署分支
        "clientWebhookList": [], // 没用。跟 webstorm 的配置保持一致
        "serverWebhookMap": { // 关键配置。项目及其流水线配置
          "project-name": { // 项目名称
            "hookUrl": "http://flow-openapi.aliyun.com/pipeline/webhook/IQJpnlAfnzicJul0WIKK", // 触发的 webhook 地址
            "webUrl": "https://flow.aliyun.com/pipelines/2948323/current" // 流水线地址，方便触发后查看流水线状态。可不填
          }
        }
      }
    ]
  }
}
```
