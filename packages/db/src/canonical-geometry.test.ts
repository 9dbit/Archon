import { describe,expect,it } from 'vitest';
import { applyCanonicalOperationToParameters } from './canonical-geometry';

describe('applyCanonicalOperationToParameters',()=>{
 it('moves canonical position without mutating input',()=>{const base={positionMm:[100,200,300],sizeMm:[400,500,600]};const next=applyCanonicalOperationToParameters(base,{type:'MOVE',targetId:'wall',payload:{deltaXmm:50,deltaZmm:-20}});expect(next.positionMm).toEqual([150,200,280]);expect(base.positionMm).toEqual([100,200,300]);});
 it('keeps semantic dimensions and render sizeMm synchronized',()=>{const next=applyCanonicalOperationToParameters({sizeMm:[5800,3000,200],widthMm:5800,heightMm:3000,depthMm:200},{type:'UPDATE',targetId:'room',payload:{widthMm:6400,heightMm:3200}});expect(next.widthMm).toBe(6400);expect(next.heightMm).toBe(3200);expect(next.sizeMm).toEqual([6400,3200,200]);});
 it('does not map invalid non-positive dimensions into sizeMm',()=>{const next=applyCanonicalOperationToParameters({sizeMm:[1000,2000,3000]},{type:'UPDATE',targetId:'x',payload:{widthMm:0,depthMm:-1}});expect(next.sizeMm).toEqual([1000,2000,3000]);});
});
