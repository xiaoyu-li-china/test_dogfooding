import math
from ode_solver import explicit_euler, runge_kutta4, rkf45, print_table, save_to_csv, plot_results


def f(x, y):
    return x + y


def exact_solution(x):
    return 2 * math.exp(x) - x - 1


print("测试案例: dy/dx = x + y, y(0) = 1")
print("=" * 60)
print(f"精确解公式: y = 2e^x - x - 1")
print()

x0, y0 = 0.0, 1.0
h = 0.1
x_end = 1.0
tol = 1e-6

euler_results = explicit_euler(f, x0, y0, h, x_end)
rk4_results = runge_kutta4(f, x0, y0, h, x_end)
rkf45_results = rkf45(f, x0, y0, x_end, tol=tol, h_init=h)

print_table(euler_results, "显式欧拉法")
print_table(rk4_results, "四阶龙格-库塔法 (RK4)")
print_table(rkf45_results, "RKF45 自适应步长法")

save_to_csv(euler_results, "euler_results.csv", "显式欧拉法")
save_to_csv(rk4_results, "rk4_results.csv", "RK4")
save_to_csv(rkf45_results, "rkf45_results.csv", "RKF45")

print("\n" + "=" * 70)
print("精度对比 (x=1.0):")
print("-" * 70)
y_exact = exact_solution(1.0)
print(f"精确解: {y_exact:.10f}")
print(f"欧拉法:  {euler_results[-1][1]:.10f}, 误差: {abs(y_exact - euler_results[-1][1]):.2e}")
print(f"RK4:     {rk4_results[-1][1]:.10f}, 误差: {abs(y_exact - rk4_results[-1][1]):.2e}")
print(f"RKF45:   {rkf45_results[-1][1]:.10f}, 误差: {abs(y_exact - rkf45_results[-1][1]):.2e}")
print("=" * 70)

print(f"\nRKF45 自适应步长使用了 {len(rkf45_results)} 个点")
print("前几个点的步长变化:")
for i in range(min(5, len(rkf45_results) - 1)):
    print(f"  x = {rkf45_results[i][0]:.4f} -> {rkf45_results[i+1][0]:.4f}, h = {rkf45_results[i+1][0] - rkf45_results[i][0]:.6f}")

all_results = {
    "显式欧拉法": euler_results,
    "RK4 固定步长": rk4_results,
    "RKF45 自适应": rkf45_results
}
plot_results(all_results, exact_solution)
