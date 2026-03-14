describe('AaltoUtils', () => {
  const { haversineKm, escHtml } = window.AaltoUtils;

  describe('haversineKm', () => {
    it('returns 0 for same point', () => {
      const p = [24.9384, 60.1699];
      expect(haversineKm(p, p)).toBe(0);
    });

    it('returns ~160 km for Helsinki to Tampere', () => {
      const helsinki = [24.9384, 60.1699];
      const tampere = [23.7573, 61.4978];
      const km = haversineKm(helsinki, tampere);
      expect(km).toBeGreaterThan(155);
      expect(km).toBeLessThan(170);
    });

    it('is symmetric', () => {
      const a = [24.9384, 60.1699];
      const b = [23.7573, 61.4978];
      expect(haversineKm(a, b)).toBe(haversineKm(b, a));
    });

    it('returns ~20000 km for antipodal points (half Earth circumference)', () => {
      const a = [0, 0];
      const b = [180, 0];
      const km = haversineKm(a, b);
      expect(km).toBeGreaterThan(19900);
      expect(km).toBeLessThan(20100);
    });
  });

  describe('escHtml', () => {
    it('escapes &', () => {
      expect(escHtml('a & b')).toBe('a &amp; b');
    });

    it('escapes < and >', () => {
      expect(escHtml('<script>')).toBe('&lt;script&gt;');
    });

    it('escapes double and single quotes', () => {
      expect(escHtml('"foo"')).toBe('&quot;foo&quot;');
      expect(escHtml("'bar'")).toBe('&#39;bar&#39;');
    });

    it('returns plain string unchanged when no special chars', () => {
      expect(escHtml('Hello World')).toBe('Hello World');
    });

    it('converts non-string to string and escapes', () => {
      expect(escHtml(123)).toBe('123');
    });
  });
});
