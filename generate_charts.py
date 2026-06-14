import os
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

# 配置学术论文排版风格：Times New Roman 字体
plt.rcParams['font.family'] = 'serif'
plt.rcParams['font.serif'] = ['Times New Roman']
plt.rcParams['font.size'] = 12

# 1. 定义 CSV 文件的相对路径（自动获取当前脚本所在目录，放哪都能跑通）
script_dir = os.path.dirname(os.path.abspath(__file__))
csv_path = os.path.join(script_dir, 'output', 'benchmark_summary.csv')

if not os.path.exists(csv_path):
    raise FileNotFoundError(
        f"找不到 CSV 文件，请确保当前脚本运行在项目根目录，且存在路径: {csv_path}"
    )

# 2. 自动读取并使用 Pandas 进行数据聚合
print("正在读取并聚合遥测数据...")
df = pd.read_csv(csv_path)

# 按 Model 分组，并将所有任务的错误数量求和
grouped = df.groupby('Model')[
    [
        'Init_Total',
        'Final_Total',
        'Init_Sec',
        'Final_Sec',
        'Init_A11y',
        'Final_A11y',
    ]
].sum()

# 打印聚合结果到终端，方便你在写报告时核对数字
print("\n===== 聚合数据统计表（自动计算完成）=====")
print(grouped)
print("=========================================\n")

# 提取模型名称列表
models = grouped.index.tolist()
x = np.arange(len(models))
width = 0.35

# =========================================================
# 图表 1：总错误数量对比图 (已换上高级深邃蓝+科技青皮肤)
# =========================================================
fig, ax = plt.subplots(figsize=(9, 6))
rects1 = ax.bar(
    x - width / 2,
    grouped['Init_Total'],
    width,
    label='Initial Total Defects',
    color='#1F3A60',  # 经典深邃蓝
)
rects2 = ax.bar(
    x + width / 2,
    grouped['Final_Total'],
    width,
    label='Final Total Defects (After Repair)',
    color='#3D9A9B',  # 现代科技青
)

ax.set_ylabel('Aggregated Total Errors (Across All Tasks)')
ax.set_title(
    'Multi-Model Evaluation: Error Reduction via Automated Self-Repair Loop'
)
ax.set_xticks(x)
ax.set_xticklabels(models)
ax.legend()
ax.grid(axis='y', linestyle='--', alpha=0.5)


# 自动在柱状图上方贴上数字标签
def autolabel(rects):
    for rect in rects:
        height = rect.get_height()
        ax.annotate(
            f'{int(height)}',
            xy=(rect.get_x() + rect.get_width() / 2, height),
            xytext=(0, 3),
            textcoords='offset points',
            ha='center',
            va='bottom',
        )


autolabel(rects1)
autolabel(rects2)
fig.tight_layout()

# 保存图表 1 到根目录下
chart1_name = 'error_reduction_chart.png'
plt.savefig(chart1_name, dpi=300)
print(f"成功生成图表 1 并保存为: {chart1_name}")
plt.close()

# =========================================================
# 图表 2：安全 vs 无障碍修复缺陷细分对比图
# =========================================================
fig, ax = plt.subplots(figsize=(11, 6.5))
w2 = 0.18

# 绘制四组柱子（安全初始、安全修复、无障碍初始、无障碍修复）
r1 = ax.bar(
    x - w2 * 1.5,
    grouped['Init_Sec'],
    w2,
    label='Initial Security Issues',
    color='#1E88E5',
)
r2 = ax.bar(
    x - w2 * 0.5,
    grouped['Final_Sec'],
    w2,
    label='Final Security Issues',
    color='#90CAF9',
)
r3 = ax.bar(
    x + w2 * 0.5,
    grouped['Init_A11y'],
    w2,
    label='Initial Accessibility Issues',
    color='#E53935',
)
r4 = ax.bar(
    x + w2 * 1.5,
    grouped['Final_A11y'],
    w2,
    label='Final Accessibility Issues',
    color='#EF9A9A',
)

ax.set_ylabel('Defect Count')
ax.set_title(
    'Domain Efficacy Analysis: Comparative Breakdown of Security vs. Accessibility (A11y)'
)
ax.set_xticks(x)
ax.set_xticklabels(models)
ax.legend()
ax.grid(axis='y', linestyle='--', alpha=0.3)

fig.tight_layout()

# 保存图表 2 到根目录下
chart2_name = 'domain_efficacy_chart.png'
plt.savefig(chart2_name, dpi=300)
print(f"成功生成图表 2 并保存为: {chart2_name}")
plt.close()