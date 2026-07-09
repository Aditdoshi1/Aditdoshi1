class BaseSource {
  constructor(name) {
    this.name = name;
  }

  async fetchDeals() {
    throw new Error('fetchDeals() not implemented');
  }
}

module.exports = {
  BaseSource,
};
