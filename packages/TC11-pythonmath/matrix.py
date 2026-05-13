import functools


EPSILON = 1e-10


def _is_zero(value: float) -> bool:
    return abs(value) < EPSILON


def _round_near_zero(value: float) -> float:
    return 0.0 if _is_zero(value) else value


class Matrix:
    def __init__(self, data):
        processed = []
        for row in data:
            processed_row = []
            for val in row:
                if isinstance(val, (int, float)):
                    processed_row.append(_round_near_zero(float(val)))
                else:
                    raise TypeError("矩阵元素必须是整数或浮点数")
            processed.append(tuple(processed_row))
        self._data = tuple(processed)
        self._rows = len(self._data)
        self._cols = len(self._data[0]) if self._rows > 0 else 0
        
        for i, row in enumerate(self._data):
            if len(row) != self._cols:
                raise ValueError(f"所有行必须具有相同的列数。第 {i} 行有 {len(row)} 列，而第 0 行有 {self._cols} 列")
        
        self._hash = None
    
    @property
    def rows(self):
        return self._rows
    
    @property
    def cols(self):
        return self._cols
    
    @property
    def shape(self):
        return (self._rows, self._cols)
    
    def __getitem__(self, idx):
        if isinstance(idx, tuple):
            i, j = idx
            return self._data[i][j]
        return self._data[idx]
    
    def __setitem__(self, idx, value):
        raise TypeError("Matrix 是不可变的，不支持赋值操作")
    
    def __hash__(self):
        if self._hash is None:
            self._hash = hash(self._data)
        return self._hash
    
    def __eq__(self, other):
        if not isinstance(other, Matrix):
            return False
        if self.shape != other.shape:
            return False
        for i in range(self._rows):
            for j in range(self._cols):
                if not _is_zero(self[i][j] - other[i][j]):
                    return False
        return True
    
    def __repr__(self):
        rows_str = []
        for row in self._data:
            formatted = []
            for x in row:
                if _is_zero(x):
                    formatted.append("0")
                elif isinstance(x, float) and x == int(x):
                    formatted.append(f"{int(x)}")
                else:
                    formatted.append(f"{x:.6g}")
            rows_str.append("  " + ", ".join(formatted))
        return "Matrix([\n" + ",\n".join(rows_str) + "\n])"
    
    def __str__(self):
        return self.__repr__()
    
    def __add__(self, other):
        if not isinstance(other, Matrix):
            raise TypeError("只能与另一个矩阵相加")
        if self.shape != other.shape:
            raise ValueError(f"矩阵形状不匹配：{self.shape} 和 {other.shape}")
        
        result = []
        for i in range(self._rows):
            row = []
            for j in range(self._cols):
                row.append(_round_near_zero(self[i][j] + other[i][j]))
            result.append(row)
        return Matrix(result)
    
    def __mul__(self, other):
        if isinstance(other, (int, float)):
            result = []
            for i in range(self._rows):
                row = []
                for j in range(self._cols):
                    row.append(_round_near_zero(self[i][j] * other))
                result.append(row)
            return Matrix(result)
        
        if not isinstance(other, Matrix):
            raise TypeError("只能与标量或另一个矩阵相乘")
        
        if self._cols != other._rows:
            raise ValueError(f"矩阵形状不匹配：{self.shape} 和 {other.shape}")
        
        result = []
        for i in range(self._rows):
            row = []
            for j in range(other._cols):
                val = 0.0
                for k in range(self._cols):
                    val += self[i][k] * other[k][j]
                row.append(_round_near_zero(val))
            result.append(row)
        return Matrix(result)
    
    def __rmul__(self, other):
        if isinstance(other, (int, float)):
            return self * other
        raise TypeError("标量乘法只能从左侧进行")
    
    def transpose(self):
        result = []
        for j in range(self._cols):
            row = []
            for i in range(self._rows):
                row.append(self[i][j])
            result.append(row)
        return Matrix(result)
    
    def determinant(self):
        if self._rows != self._cols:
            raise ValueError("只有方阵才能计算行列式")
        
        n = self._rows
        
        if n == 1:
            return self[0][0]
        
        if n == 2:
            return _round_near_zero(self[0][0] * self[1][1] - self[0][1] * self[1][0])
        
        L, U, pivot_sign = self._lu_decompose()
        
        det = pivot_sign
        for i in range(n):
            det *= U[i][i]
        
        return _round_near_zero(det)
    
    @functools.lru_cache(maxsize=128)
    def _lu_decompose(self):
        n = self._rows
        A = [[self[i][j] for j in range(n)] for i in range(n)]
        L = [[0.0 for _ in range(n)] for _ in range(n)]
        U = [[0.0 for _ in range(n)] for _ in range(n)]
        
        for i in range(n):
            L[i][i] = 1.0
        
        pivot_sign = 1
        
        for k in range(n):
            pivot_row = k
            for i in range(k + 1, n):
                if abs(A[i][k]) > abs(A[pivot_row][k]):
                    pivot_row = i
            
            if pivot_row != k:
                A[k], A[pivot_row] = A[pivot_row], A[k]
                pivot_sign = -pivot_sign
            
            if _is_zero(A[k][k]):
                L_mat = Matrix(L)
                U_mat = Matrix(U)
                return L_mat, U_mat, 0.0
            
            for j in range(k, n):
                U[k][j] = A[k][j]
            
            for i in range(k + 1, n):
                L[i][k] = A[i][k] / U[k][k]
                for j in range(k, n):
                    A[i][j] = A[i][j] - L[i][k] * U[k][j]
        
        for i in range(n):
            for j in range(n):
                L[i][j] = _round_near_zero(L[i][j])
                U[i][j] = _round_near_zero(U[i][j])
        
        L_mat = Matrix(L)
        U_mat = Matrix(U)
        
        return L_mat, U_mat, pivot_sign
    
    def lu_decomposition(self):
        if self._rows != self._cols:
            raise ValueError("只有方阵才能进行 LU 分解")
        return self._lu_decompose()
    
    @staticmethod
    def zeros(rows, cols):
        return Matrix([[0.0 for _ in range(cols)] for _ in range(rows)])
    
    @staticmethod
    def ones(rows, cols):
        return Matrix([[1.0 for _ in range(cols)] for _ in range(rows)])
    
    @staticmethod
    def identity(n):
        m = Matrix.zeros(n, n)
        data_list = [list(row) for row in m._data]
        for i in range(n):
            data_list[i][i] = 1.0
        return Matrix(data_list)
