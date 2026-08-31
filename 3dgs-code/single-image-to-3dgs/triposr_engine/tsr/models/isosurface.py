from typing import Callable, Optional, Tuple

import numpy as np
import torch
import torch.nn as nn

# PyMCubes 사용 (torchmcubes 대신 - C++ 컴파일 불필요)
import mcubes


def _mcubes_marching_cubes(vol, threshold):
    """PyMCubes를 torchmcubes와 동일한 인터페이스로 감싸주는 래퍼 함수"""
    vol_np = vol.detach().cpu().numpy().astype(np.float32)
    vertices, triangles = mcubes.marching_cubes(vol_np, threshold)
    vertices = torch.from_numpy(vertices.astype(np.float32))
    triangles = torch.from_numpy(triangles.astype(np.int64))
    return vertices, triangles


class IsosurfaceHelper(nn.Module):
    points_range: Tuple[float, float] = (0, 1)

    @property
    def grid_vertices(self) -> torch.FloatTensor:
        raise NotImplementedError


class MarchingCubeHelper(IsosurfaceHelper):
    def __init__(self, resolution: int) -> None:
        super().__init__()
        self.resolution = resolution
        self.mc_func: Callable = _mcubes_marching_cubes
        self._grid_vertices: Optional[torch.FloatTensor] = None

    @property
    def grid_vertices(self) -> torch.FloatTensor:
        if self._grid_vertices is None:
            # keep the vertices on CPU so that we can support very large resolution
            x, y, z = (
                torch.linspace(*self.points_range, self.resolution),
                torch.linspace(*self.points_range, self.resolution),
                torch.linspace(*self.points_range, self.resolution),
            )
            x, y, z = torch.meshgrid(x, y, z, indexing="ij")
            verts = torch.cat(
                [x.reshape(-1, 1), y.reshape(-1, 1), z.reshape(-1, 1)], dim=-1
            ).reshape(-1, 3)
            self._grid_vertices = verts
        return self._grid_vertices

    def forward(
        self,
        level: torch.FloatTensor,
    ) -> Tuple[torch.FloatTensor, torch.LongTensor]:
        level = -level.view(self.resolution, self.resolution, self.resolution)
        v_pos, t_pos_idx = self.mc_func(level.detach(), 0.0)
        v_pos = v_pos[..., [2, 1, 0]]
        v_pos = v_pos / (self.resolution - 1.0)
        return v_pos.to(level.device), t_pos_idx.to(level.device)

