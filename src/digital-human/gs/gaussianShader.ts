/**
 * gaussianShader — 3D Gaussian Splatting WebGL 自定义 shader
 *
 * 屏幕空间高斯光栅化: 每个 Gaussian → 一个 quad (2 triangles),
 * 片段着色器计算 2D Gaussian 衰减 + SH 视角相关颜色 + alpha 混合。
 *
 * 参考: "3D Gaussian Splatting for Real-Time Radiance Field Rendering" (Kerbl et al.)
 */

// ─── Vertex Shader ─────────────────────────────────────────────────────────

export const gaussianVertShader = /* glsl */ `
  precision highp float;

  // Per-instance attributes (每个 Gaussian 一个)
  attribute vec3 aPosition;      // 3D 中心位置
  attribute vec3 aScale;         // 3D 缩放 (log-space, 需 exp)
  attribute vec4 aRotation;      // 四元数旋转
  attribute float aOpacity;      // 不透明度 (sigmoid 前)
  attribute vec3 aSH0;           // SH DC (base color, 0-阶)
  attribute vec3 aSH1_0;         // SH degree 1, band 0
  attribute vec3 aSH1_1;         // SH degree 1, band 1
  attribute vec3 aSH1_2;         // SH degree 1, band 2

  // Uniforms
  uniform mat4 uViewProj;        // 视图投影矩阵
  uniform mat4 uView;            // 视图矩阵 (用于 cov 变换)
  uniform vec3 uCamPos;          // 相机世界位置
  uniform vec2 uViewport;        // 视口尺寸 (w, h)
  uniform float uFocalY;         // 垂直焦距 (pixels) = height / (2*tan(fovY/2))
  uniform float uFocalX;         // 水平焦距
  uniform float uSHDegree;       // SH 阶数 (0/1/3)

  // Varying → fragment
  varying vec4 vColor;           // 计算好的颜色
  varying float vOpacity;        // 不透明度
  varying vec2 vCenter;          // 屏幕空间投影中心 (pixels)
  varying mat2 vCov2D;           // 2D 协方差矩阵
  varying float vDepth;          // 深度 (用于排序)

  // 四元数 → 旋转矩阵
  mat3 quatToMat3(vec4 q) {
    float qx = q.x, qy = q.y, qz = q.z, qw = q.w;
    return mat3(
      1.0 - 2.0*(qy*qy + qz*qz),  2.0*(qx*qy - qz*qw),         2.0*(qx*qz + qy*qw),
      2.0*(qx*qy + qz*qw),         1.0 - 2.0*(qx*qx + qz*qz),   2.0*(qy*qz - qx*qw),
      2.0*(qx*qz - qy*qw),         2.0*(qy*qz + qx*qw),         1.0 - 2.0*(qx*qx + qy*qy)
    );
  }

  // SH 评估 (仅 degree 0: 直接用 DC)
  vec3 evalSH0(vec3 dc) {
    return 0.28209479177387814 * dc;  // SH constant for l=0
  }

  // SH degree 1 评估
  vec3 evalSH1(vec3 dc, vec3 sh1_0, vec3 sh1_1, vec3 sh1_2, vec3 dir) {
    float c0 = 0.28209479177387814;
    float c1 = 0.4886025119029199;
    return c0 * dc + c1 * (sh1_0 * dir.y + sh1_1 * dir.z + sh1_2 * dir.x);
  }

  void main() {
    // 1) 解包旋转 + 缩放
    mat3 R = quatToMat3(aRotation);
    vec3 scale = exp(aScale);  // log-space → linear

    // 2) 视图空间位置
    vec4 viewPos = uView * vec4(aPosition, 1.0);
    vec3 viewDir = normalize(uCamPos - aPosition);

    // 3) 投影到屏幕
    vec4 clipPos = uViewProj * vec4(aPosition, 1.0);
    vec2 ndc = clipPos.xy / clipPos.w;
    vec2 screenCenter = (ndc * 0.5 + 0.5) * uViewport;

    // 4) 3D 协方差 → 2D 协方差 (近似: Jacobian of projection)
    //    3D cov = R * diag(scale^2) * R^T
    mat3 cov3D = R * mat3(
      scale.x * scale.x, 0, 0,
      0, scale.y * scale.y, 0,
      0, 0, scale.z * scale.z
    ) * transpose(R);

    //    Projection Jacobian approx (perspective)
    float fx = uFocalX;
    float fy = uFocalY;
    float tz = viewPos.z;  // depth in view space

    mat3 J = mat3(
      fx / tz,     0.0,  -fx * viewPos.x / (tz * tz),
      0.0,         fy / tz, -fy * viewPos.y / (tz * tz),
      0.0,         0.0,  0.0
    );

    //    2D cov = top-left 2x2 of J * cov3D * J^T
    mat3 tmp = J * cov3D * transpose(J);
    mat2 cov2D = mat2(tmp[0][0], tmp[0][1], tmp[1][0], tmp[1][1]);

    //    加小常数防数值退化
    cov2D += mat2(0.3, 0.0, 0.0, 0.3);

    // 5) 颜色: SH 评估
    vec3 viewDirNorm = normalize(viewDir);
    vec3 color;
    if (uSHDegree < 1.0) {
      color = evalSH0(aSH0);
    } else {
      color = evalSH1(aSH0, aSH1_0, aSH1_1, aSH1_2, viewDirNorm);
    }
    color = clamp(color, 0.0, 1.0);

    // 6) 不透明度
    float alpha = 1.0 / (1.0 + exp(-aOpacity));  // sigmoid

    // 7) 输出
    vColor = vec4(color, alpha);
    vOpacity = alpha;
    vCenter = screenCenter;
    vCov2D = cov2D;
    vDepth = clipPos.w;

    // 屏幕空间 quad 的 4 个顶点: 覆盖 3-sigma 椭圆范围
    // 计算 2D cov 的特征值(椭圆半径)
    float a = cov2D[0][0];
    float b = cov2D[0][1];
    float c = cov2D[1][1];
    float trace = a + c;
    float det = a * c - b * b;
    float disc = sqrt(max(0.0, trace * trace - 4.0 * det));
    float lambda1 = 0.5 * (trace + disc);
    float lambda2 = 0.5 * (trace - disc);
    float radius1 = 3.0 * sqrt(max(0.0, lambda1));
    float radius2 = 3.0 * sqrt(max(0.0, lambda2));

    // 特征向量(椭圆主轴方向)
    float angle = atan(b, a - c) * 0.5;
    vec2 axis1 = vec2(cos(angle), sin(angle));
    vec2 axis2 = vec2(-sin(angle), cos(angle));

    // 4 个角(在屏幕空间), 每个顶点偏移一个方向
    int corner = gl_VertexID % 4;
    vec2 offset;
    if (corner == 0) offset = -axis1 * radius1 - axis2 * radius2;
    else if (corner == 1) offset = axis1 * radius1 - axis2 * radius2;
    else if (corner == 2) offset = -axis1 * radius1 + axis2 * radius2;
    else offset = axis1 * radius1 + axis2 * radius2;

    vec2 screenPos = screenCenter + offset;
    vec2 finalNDC = (screenPos / uViewport) * 2.0 - 1.0;

    gl_Position = vec4(finalNDC * clipPos.w, clipPos.zw);
  }
`;

// ─── Fragment Shader ───────────────────────────────────────────────────────

export const gaussianFragShader = /* glsl */ `
  precision highp float;

  varying vec4 vColor;
  varying float vOpacity;
  varying vec2 vCenter;
  varying mat2 vCov2D;
  varying float vDepth;

  void main() {
    // 屏幕空间到中心的偏移
    vec2 d = gl_FragCoord.xy - vCenter;

    // 2D Gaussian 衰减: G(x) = exp(-0.5 * x^T * cov^-1 * x)
    float det = vCov2D[0][0] * vCov2D[1][1] - vCov2D[0][1] * vCov2D[1][0];
    if (det <= 0.0) discard;

    mat2 covInv = mat2(vCov2D[1][1], -vCov2D[0][1], -vCov2D[1][0], vCov2D[0][0]) / det;

    float power = -0.5 * (covInv[0][0] * d.x * d.x + (covInv[0][1] + covInv[1][0]) * d.x * d.y + covInv[1][1] * d.y * d.y);
    float alpha = vOpacity * exp(power);

    // Alpha < 1/255 → 丢弃 (减少 overdraw)
    if (alpha < 0.0039) discard;

    gl_FragColor = vec4(vColor.rgb, clamp(alpha, 0.0, 1.0));
  }
`;

// ─── 简单 Point Cloud Shader (移动端降级) ───────────────────────────────────

export const pointCloudVertShader = /* glsl */ `
  precision highp float;

  attribute vec3 aPosition;
  attribute vec3 aColor;
  attribute float aSize;

  uniform mat4 uViewProj;
  uniform vec2 uViewport;

  varying vec3 vColor;

  void main() {
    vec4 clipPos = uViewProj * vec4(aPosition, 1.0);
    gl_Position = clipPos;
    gl_PointSize = aSize * 600.0 / clipPos.w;  // screen-space size
    vColor = aColor;
  }
`;

export const pointCloudFragShader = /* glsl */ `
  precision highp float;

  varying vec3 vColor;

  void main() {
    // Circular point with soft edge
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = 1.0 - smoothstep(0.8, 1.0, d);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vColor, alpha * 0.7);
  }
`;
