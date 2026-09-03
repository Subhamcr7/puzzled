import { jigsawLines } from './jigsaw-lines';

describe('jigsawLines', () => {
  it('produces a clean rectangular outer frame', () => {
    const { outer } = jigsawLines(5);
    expect(outer).toContain(`M 0 0 H 5 V 5 H 0 Z`);
  });

  it('emits one vertical and one horizontal boundary per interior line', () => {
    const { dim, verticals, horizontals } = jigsawLines(6);
    expect(dim).toBe(6);
    expect(verticals).toHaveLength(5); // 6-1
    expect(horizontals).toHaveLength(5);
  });

  it('knobs never cross the outer 0..dim frame (flat outer edges)', () => {
    const { verticals, horizontals, dim } = jigsawLines(4);
    // A vertical boundary is at an integer column, so it can never go below 0
    // or beyond dim; KNOB stays well inside the cell.
    for (const v of verticals) {
      const xs = [...v.matchAll(/(?<=M |L |C )(\d+)/g)];
      for (const m of xs) {
        const x = Number(m[1]);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(dim);
      }
    }
    // No knob coordinate in the whole path set exceeds the frame bounds.
    const all = [...verticals, ...horizontals].join(' ');
    const coords = [...all.matchAll(/(\d+\.?\d*)/g)].map((m) => Number(m[1]));
    expect(Math.max(...coords)).toBeLessThanOrEqual(dim);
    expect(Math.min(...coords)).toBeGreaterThanOrEqual(0);
  });

  it('uses alternating knob directions so neighbouring pieces interlock', () => {
    const { verticals, horizontals } = jigsawLines(8);
    // `x - 0.26` always ends in `.74`, `x + 0.26` in `.26`, for integer
    // boundaries. Both must appear on every interior line so it zig-zags like a
    // jigsaw cut rather than staying straight.
    for (const v of verticals) {
      expect(v).toContain('.74');
      expect(v).toContain('.26');
    }
    for (const h of horizontals) {
      expect(h).toContain('.74');
      expect(h).toContain('.26');
    }
    // The generated paths are not straight lines.
    for (const seg of [...verticals, ...horizontals]) {
      expect(seg.length).toBeGreaterThan(20);
    }
  });
});
