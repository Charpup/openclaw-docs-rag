const VectorStore = require('../src/store');

describe('store', () => {
  let store;
  
  beforeEach(() => {
    store = new VectorStore({
      host: 'localhost',
      database: 'test_db',
      user: 'test',
      password: 'test'
    });
  });

  afterEach(async () => {
    await store.close();
  });

  test('store initializes without error', async () => {
    // This would need a real database connection
    // For now, just verify the class instantiates
    expect(store).toBeInstanceOf(VectorStore);
  });
});
