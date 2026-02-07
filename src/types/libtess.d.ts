declare module "libtess" {
  export class GluTesselator {
    gluTessCallback(type: number, callback: (...args: unknown[]) => unknown): void;
    gluTessProperty(property: number, value: number): void;
    gluTessNormal(x: number, y: number, z: number): void;
    gluTessBeginPolygon(data?: unknown): void;
    gluTessBeginContour(): void;
    gluTessVertex(coords: number[], data: unknown): void;
    gluTessEndContour(): void;
    gluTessEndPolygon(): void;
  }

  export const windingRule: {
    GLU_TESS_WINDING_ODD: number;
    GLU_TESS_WINDING_NONZERO: number;
    GLU_TESS_WINDING_POSITIVE: number;
    GLU_TESS_WINDING_NEGATIVE: number;
    GLU_TESS_WINDING_ABS_GEQ_TWO: number;
  };

  export const primitiveType: {
    GL_LINE_LOOP: number;
    GL_TRIANGLES: number;
    GL_TRIANGLE_STRIP: number;
    GL_TRIANGLE_FAN: number;
  };

  export const errorType: {
    GLU_TESS_MISSING_BEGIN_POLYGON: number;
    GLU_TESS_MISSING_END_POLYGON: number;
    GLU_TESS_MISSING_BEGIN_CONTOUR: number;
    GLU_TESS_MISSING_END_CONTOUR: number;
    GLU_TESS_COORD_TOO_LARGE: number;
    GLU_TESS_NEED_COMBINE_CALLBACK: number;
  };

  export const gluEnum: {
    GLU_TESS_BEGIN: number;
    GLU_TESS_VERTEX: number;
    GLU_TESS_END: number;
    GLU_TESS_ERROR: number;
    GLU_TESS_EDGE_FLAG: number;
    GLU_TESS_COMBINE: number;
    GLU_TESS_BEGIN_DATA: number;
    GLU_TESS_VERTEX_DATA: number;
    GLU_TESS_END_DATA: number;
    GLU_TESS_ERROR_DATA: number;
    GLU_TESS_EDGE_FLAG_DATA: number;
    GLU_TESS_COMBINE_DATA: number;
    GLU_TESS_WINDING_RULE: number;
    GLU_TESS_BOUNDARY_ONLY: number;
    GLU_TESS_TOLERANCE: number;
  };
}
