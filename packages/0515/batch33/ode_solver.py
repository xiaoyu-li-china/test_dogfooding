import math
import csv
from typing import Callable, List, Tuple, Optional

try:
    import matplotlib.pyplot as plt
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False


def explicit_euler(f: Callable, x0: float, y0: float, h: float, x_end: float) -> List[Tuple[float, float]]:
    results = [(x0, y0)]
    x, y = x0, y0
    while x < x_end:
        y = y + h * f(x, y)
        x = x + h
        results.append((x, y))
    return results


def runge_kutta4(f: Callable, x0: float, y0: float, h: float, x_end: float) -> List[Tuple[float, float]]:
    results = [(x0, y0)]
    x, y = x0, y0
    while x < x_end:
        k1 = f(x, y)
        k2 = f(x + h / 2, y + h * k1 / 2)
        k3 = f(x + h / 2, y + h * k2 / 2)
        k4 = f(x + h, y + h * k3)
        y = y + h * (k1 + 2 * k2 + 2 * k3 + k4) / 6
        x = x + h
        results.append((x, y))
    return results


def rkf45(f: Callable, x0: float, y0: float, x_end: float, 
          tol: float = 1e-6, h_init: float = 0.01, 
          h_min: float = 1e-10, h_max: float = 1.0) -> List[Tuple[float, float]]:
    results = [(x0, y0)]
    x, y = x0, y0
    h = h_init
    
    a2, a3, a4, a5, a6 = 1/4, 3/8, 12/13, 1, 1/2
    b21 = 1/4
    b31, b32 = 3/32, 9/32
    b41, b42, b43 = 1932/2197, -7200/2197, 7296/2197
    b51, b52, b53, b54 = 439/216, -8, 3680/513, -845/4104
    b61, b62, b63, b64, b65 = -8/27, 2, -3544/2565, 1859/4104, -11/40
    
    c4_1, c4_2, c4_3, c4_4, c4_5 = 25/216, 0, 1408/2565, 2197/4104, -1/5
    c5_1, c5_2, c5_3, c5_4, c5_5, c5_6 = 16/135, 0, 6656/12825, 28561/56430, -9/50, 2/55
    
    while x < x_end:
        if x + h > x_end:
            h = x_end - x
            
        k1 = h * f(x, y)
        k2 = h * f(x + a2 * h, y + b21 * k1)
        k3 = h * f(x + a3 * h, y + b31 * k1 + b32 * k2)
        k4 = h * f(x + a4 * h, y + b41 * k1 + b42 * k2 + b43 * k3)
        k5 = h * f(x + a5 * h, y + b51 * k1 + b52 * k2 + b53 * k3 + b54 * k4)
        k6 = h * f(x + a6 * h, y + b61 * k1 + b62 * k2 + b63 * k3 + b64 * k4 + b65 * k5)
        
        y4 = y + c4_1 * k1 + c4_2 * k2 + c4_3 * k3 + c4_4 * k4 + c4_5 * k5
        y5 = y + c5_1 * k1 + c5_2 * k2 + c5_3 * k3 + c5_4 * k4 + c5_5 * k5 + c5_6 * k6
        
        error = abs(y5 - y4)
        
        if error < tol or h <= h_min:
            x = x + h
            y = y5
            results.append((x, y))
        
        if error > 0:
            h_new = 0.9 * h * (tol / error) ** 0.2
            h = max(min(h_new, h_max), h_min)
        else:
            h = min(h * 2, h_max)
    
    return results


def print_table(results: List[Tuple[float, float]], method_name: str) -> None:
    print(f"\n{method_name} 计算结果:")
    print("-" * 35)
    print(f"{'序号':>6} {'x':>12} {'y':>12}")
    print("-" * 35)
    for i, (x, y) in enumerate(results):
        print(f"{i:6d} {x:12.6f} {y:12.6f}")
    print("-" * 35)
    print(f"共 {len(results)} 个点")


def save_to_csv(results: List[Tuple[float, float]], filename: str, method_name: str = "") -> None:
    with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        if method_name:
            writer.writerow([f'方法: {method_name}'])
        writer.writerow(['x', 'y'])
        for x, y in results:
            writer.writerow([x, y])
    print(f"结果已保存到 {filename}")


def plot_results(all_results: dict, exact_func: Optional[Callable] = None) -> None:
    if not MATPLOTLIB_AVAILABLE:
        print("matplotlib 不可用，无法绘图")
        return
    
    plt.figure(figsize=(10, 6))
    
    markers = ['o', 's', '^', 'D']
    colors = ['red', 'blue', 'green', 'purple']
    
    for i, (name, results) in enumerate(all_results.items()):
        x_vals = [r[0] for r in results]
        y_vals = [r[1] for r in results]
        plt.plot(x_vals, y_vals, label=name, marker=markers[i % len(markers)], 
                 markersize=4, linestyle='-', color=colors[i % len(colors)], alpha=0.7)
    
    if exact_func:
        try:
            x_min = min([r[0] for results in all_results.values() for r in results])
            x_max = max([r[0] for results in all_results.values() for r in results])
            x_exact = [x_min + i * (x_max - x_min) / 1000 for i in range(1001)]
            y_exact = [exact_func(x) for x in x_exact]
            plt.plot(x_exact, y_exact, label='精确解', linestyle='--', color='black', linewidth=2)
        except:
            pass
    
    plt.xlabel('x', fontsize=12)
    plt.ylabel('y', fontsize=12)
    plt.title('常微分方程数值解对比', fontsize=14, fontweight='bold')
    plt.legend(fontsize=10)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig('ode_solution.png', dpi=150)
    print("解曲线已保存到 ode_solution.png")
    plt.show()


def main():
    print("常微分方程数值求解器")
    print("=" * 50)
    
    func_str = input("请输入导数函数 f(x,y) = ")
    x0 = float(input("请输入初始 x0 = "))
    y0 = float(input("请输入初始 y0 = "))
    h = float(input("请输入固定步长 h = "))
    x_end = float(input("请输入结束 x = "))
    tol = float(input("请输入 RKF45 容差 (默认 1e-6): ") or "1e-6")
    
    def f(x, y):
        return eval(func_str)
    
    euler_results = explicit_euler(f, x0, y0, h, x_end)
    rk4_results = runge_kutta4(f, x0, y0, h, x_end)
    rkf45_results = rkf45(f, x0, y0, x_end, tol=tol, h_init=h)
    
    print_table(euler_results, "显式欧拉法")
    print_table(rk4_results, "四阶龙格-库塔法 (RK4)")
    print_table(rkf45_results, "RKF45 自适应步长法")
    
    save_to_csv(euler_results, "euler_results.csv", "显式欧拉法")
    save_to_csv(rk4_results, "rk4_results.csv", "RK4")
    save_to_csv(rkf45_results, "rkf45_results.csv", "RKF45")
    
    all_results = {
        "显式欧拉法": euler_results,
        "RK4 固定步长": rk4_results,
        "RKF45 自适应": rkf45_results
    }
    plot_results(all_results)


if __name__ == "__main__":
    main()
