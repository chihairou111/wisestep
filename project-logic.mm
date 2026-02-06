<?xml version="1.0" encoding="UTF-8"?>
<map version="1.0.1">
  <node TEXT="my-prototype - 逻辑顺序（产品视角）" ID="ID_ROOT" CREATED="1770313403494" MODIFIED="1770313403494">
    <hook NAME="MapStyle">
      <properties fit_to_viewport="false"/>
    </hook>

    <node TEXT="1) 进入应用" ID="ID_FLOW" CREATED="1770313403494" MODIFIED="1770313403494">
      <node TEXT="如果已有学习计划 → 直接进入主页" ID="ID_FLOW_1" CREATED="1770313403494" MODIFIED="1770313403494"/>
      <node TEXT="如果没有学习计划 → 进入引导流程" ID="ID_FLOW_2" CREATED="1770313403494" MODIFIED="1770313403494">
        <node TEXT="选择学科" ID="ID_FLOW_2_1" CREATED="1770313403494" MODIFIED="1770313403494"/>
        <node TEXT="填写项目/学习目标描述" ID="ID_FLOW_2_2" CREATED="1770313403494" MODIFIED="1770313403494"/>
        <node TEXT="生成阶段与任务清单" ID="ID_FLOW_2_3" CREATED="1770313403494" MODIFIED="1770313403494"/>
      </node>
    </node>

    <node TEXT="2) 主页（Dashboard）" ID="ID_TASK" CREATED="1770313403494" MODIFIED="1770313403494">
      <node TEXT="展示阶段列表与进度" ID="ID_TASK_1" CREATED="1770313403494" MODIFIED="1770313403494"/>
      <node TEXT="展示『今日指数』卡片（可展开）" ID="ID_TASK_2" CREATED="1770313403494" MODIFIED="1770313403494"/>
      <node TEXT="点击某个阶段 → 查看该阶段的任务列表" ID="ID_TASK_3" CREATED="1770313403494" MODIFIED="1770313403494"/>
      <node TEXT="点击 Start 开始某个任务 → 进入计时器页面" ID="ID_TASK_4" CREATED="1770313403494" MODIFIED="1770313403494"/>
      <node TEXT="重置：清空学习计划与进度 → 回到引导/首页" ID="ID_TASK_5" CREATED="1770313403494" MODIFIED="1770313403494"/>
    </node>

    <node TEXT="3) 计时器任务进行中" ID="ID_INDEX" CREATED="1770313403494" MODIFIED="1770313403494">
      <node TEXT="进行操作：暂停/继续" ID="ID_INDEX_1" CREATED="1770313403494" MODIFIED="1770313403494"/>
      <node TEXT="可打开 AI 助手聊天：围绕当前任务提问、获取引导" ID="ID_INDEX_2" CREATED="1770313403494" MODIFIED="1770313403494"/>
      <node TEXT="结束方式分两类" ID="ID_INDEX_3" CREATED="1770313403494" MODIFIED="1770313403494">
        <node TEXT="A. 正常完成（倒计时结束 / 手动完成用于测试）" ID="ID_INDEX_3_1" CREATED="1770313403494" MODIFIED="1770313403494">
          <node TEXT="该任务被标记为“已完成”" ID="ID_INDEX_3_1_1" CREATED="1770313403494" MODIFIED="1770313403494"/>
          <node TEXT="触发一次『今日指数』评估/更新" ID="ID_INDEX_3_1_2" CREATED="1770313403494" MODIFIED="1770313403494"/>
        </node>
        <node TEXT="B. 中途退出（Stop）" ID="ID_INDEX_3_2" CREATED="1770313403494" MODIFIED="1770313403494">
          <node TEXT="弹窗询问：为什么退出？（预设选项 + 其他输入）" ID="ID_INDEX_3_2_1" CREATED="1770313403494" MODIFIED="1770313403494"/>
          <node TEXT="退出原因会被判断为 positive / negative" ID="ID_INDEX_3_2_2" CREATED="1770313403494" MODIFIED="1770313403494"/>
          <node TEXT="触发一次『今日指数』评估/更新（positive 可不扣分）" ID="ID_INDEX_3_2_3" CREATED="1770313403494" MODIFIED="1770313403494"/>
        </node>
      </node>
    </node>

    <node TEXT="4) 今日指数（0-10）" ID="ID_AI" CREATED="1770313403494" MODIFIED="1770313403494">
      <node TEXT="生成时机：第一次任务结束后生成；之后每次任务结束都会重新评估" ID="ID_AI_1" CREATED="1770313403494" MODIFIED="1770313403494"/>
      <node TEXT="展示：数字 + 渐变条 + 与昨天对比" ID="ID_AI_2" CREATED="1770313403494" MODIFIED="1770313403494"/>
      <node TEXT="展开：生成简短解释（为什么是这个分）+ 一条改进建议" ID="ID_AI_3" CREATED="1770313403494" MODIFIED="1770313403494"/>
    </node>

    <node TEXT="5) AI 助手（贯穿全程）" ID="ID_DATA" CREATED="1770313403494" MODIFIED="1770313403494">
      <node TEXT="对话：以提问引导用户说清具体困难" ID="ID_DATA_1" CREATED="1770313403494" MODIFIED="1770313403494"/>
      <node TEXT="习性：可记录学习习惯/问题模式；改善后可删除（会保留历史）" ID="ID_DATA_2" CREATED="1770313403494" MODIFIED="1770313403494"/>
      <node TEXT="指数：根据完成情况、退出情况、习性变化给出是否调整" ID="ID_DATA_3" CREATED="1770313403494" MODIFIED="1770313403494"/>
    </node>
  </node>
</map>
