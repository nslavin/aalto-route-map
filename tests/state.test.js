describe('state', () => {
  const A = window.Aalto;

  beforeEach(() => {
    localStorage.clear();
  });

  describe('loadPanels', () => {
    it('returns null when key is missing', () => {
      expect(A.loadPanels()).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      localStorage.setItem('aalto_panels', 'not json');
      expect(A.loadPanels()).toBeNull();
    });

    it('returns shape with defaults for valid minimal JSON', () => {
      localStorage.setItem('aalto_panels', '{}');
      const got = A.loadPanels();
      expect(got).toEqual({
        listCollapsed: false,
        routeCollapsed: false,
        panelOpen: false,
        selectedId: null,
        activeListFilter: 'all',
        activeSortMode: 'alphabet',
        mobileActiveTab: 'all',
        mobileShowingDetail: false,
      });
    });

    it('parses selectedId only when number', () => {
      localStorage.setItem('aalto_panels', JSON.stringify({ selectedId: 42 }));
      expect(A.loadPanels().selectedId).toBe(42);
      localStorage.setItem('aalto_panels', JSON.stringify({ selectedId: '42' }));
      expect(A.loadPanels().selectedId).toBeNull();
    });

    it('accepts only fav or visited for activeListFilter', () => {
      localStorage.setItem('aalto_panels', JSON.stringify({ activeListFilter: 'fav' }));
      expect(A.loadPanels().activeListFilter).toBe('fav');
      localStorage.setItem('aalto_panels', JSON.stringify({ activeListFilter: 'visited' }));
      expect(A.loadPanels().activeListFilter).toBe('visited');
      localStorage.setItem('aalto_panels', JSON.stringify({ activeListFilter: 'other' }));
      expect(A.loadPanels().activeListFilter).toBe('all');
    });

    it('accepts only valid activeSortMode', () => {
      localStorage.setItem('aalto_panels', JSON.stringify({ activeSortMode: 'distance' }));
      expect(A.loadPanels().activeSortMode).toBe('distance');
      localStorage.setItem('aalto_panels', JSON.stringify({ activeSortMode: 'invalid' }));
      expect(A.loadPanels().activeSortMode).toBe('alphabet');
    });

    it('accepts only valid mobileActiveTab', () => {
      localStorage.setItem('aalto_panels', JSON.stringify({ mobileActiveTab: 'route' }));
      expect(A.loadPanels().mobileActiveTab).toBe('route');
      localStorage.setItem('aalto_panels', JSON.stringify({ mobileActiveTab: 'other' }));
      expect(A.loadPanels().mobileActiveTab).toBe('all');
    });
  });

  describe('savePanels', () => {
    it('writes expected shape to localStorage', () => {
      A.listCollapsed = true;
      A.activeListFilter = 'fav';
      A.activeSortMode = 'distance';
      A.selectedId = 10;
      document.getElementById('route-section').classList.add('collapsed');
      document.getElementById('panel').classList.add('open');

      A.savePanels();

      const raw = localStorage.getItem('aalto_panels');
      expect(raw).toBeTruthy();
      const stored = JSON.parse(raw);
      expect(stored.listCollapsed).toBe(true);
      expect(stored.routeCollapsed).toBe(true);
      expect(stored.panelOpen).toBe(true);
      expect(stored.selectedId).toBe(10);
      expect(stored.activeListFilter).toBe('fav');
      expect(stored.activeSortMode).toBe('distance');
      expect(stored.mobileActiveTab).toBe('all');
      expect(stored.mobileShowingDetail).toBe(false);
    });

    it('does not run when route-section or panel is missing', () => {
      const routeEl = document.getElementById('route-section');
      const panelEl = document.getElementById('panel');
      routeEl.remove();
      A.savePanels();
      expect(localStorage.getItem('aalto_panels')).toBeNull();
      routeEl.id = 'route-section';
      document.body.appendChild(routeEl);
    });
  });

  describe('roundtrip', () => {
    it('loadPanels(savePanels()) restores same shape', () => {
      A.listCollapsed = true;
      document.getElementById('route-section').classList.add('collapsed');
      document.getElementById('panel').classList.remove('open');
      A.activeListFilter = 'visited';
      A.activeSortMode = 'distanceFromCenter';
      A.selectedId = 5;
      A.savePanels();

      const loaded = A.loadPanels();
      expect(loaded.listCollapsed).toBe(true);
      expect(loaded.routeCollapsed).toBe(true);
      expect(loaded.panelOpen).toBe(false);
      expect(loaded.selectedId).toBe(5);
      expect(loaded.activeListFilter).toBe('visited');
      expect(loaded.activeSortMode).toBe('distanceFromCenter');
      expect(loaded.mobileActiveTab).toBe('all');
      expect(loaded.mobileShowingDetail).toBe(false);
    });
  });
});
