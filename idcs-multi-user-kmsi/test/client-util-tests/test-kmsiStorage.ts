import { expect } from "chai";
import { getExistingKmsi, storeKmsiSetting, clearKmsiEntry } from "../../client/util/kmsiStorageUtil";


const KMSI_STORE_KEY = "iam_kmsi_info"

class DummyStore {
  store: any;

  constructor() {
    this.store = {};
  }

  getItem(key){
    if(this.store[key]){
      return this.store[key];
    }
    return null;
  }

  setItem(key, value){
    this.store[key] = value;
  }

  removeItem(key){
    if(this.store[key]){
      delete this.store[key];
    }    
  }
}

const dummyStore = new DummyStore();

before(() => {
  Object.defineProperty(global, 'window', {
    value: {
      localStorage: dummyStore
    }
  });
});

afterEach(()=>{
  dummyStore.removeItem(KMSI_STORE_KEY);
})

describe("KMSI Storage Utility", () => {
  describe("Get Existing KMSI", () => {
    it("Returns an empty array if no stored KMSI info", () => {
      let storedKMSI = getExistingKmsi();
      expect(storedKMSI).to.deep.equal([])
    });

    it("Returns a structured KMSI object from a stored string", () => {
      let expectedResult = [{displayName:"test",kmsiToken:"test"}];
      dummyStore.setItem(KMSI_STORE_KEY, JSON.stringify(expectedResult));
      let storedKMSI = getExistingKmsi();
      expect(storedKMSI).to.deep.equal(expectedResult);
    });

    it("Filters out malformed results - absent value", () => {
      let malformedEntry = [
        {displayName:"test",kmsiToken:"test"},
        {displayName:"testMalformed"},
        {kmsiToken:"testMalformed"}
      ];
      dummyStore.setItem(KMSI_STORE_KEY, JSON.stringify(malformedEntry));
      let storedKMSI = getExistingKmsi();
      let expectedResult = [{displayName:"test",kmsiToken:"test"}];
      expect(storedKMSI).to.deep.equal(expectedResult);
    });

    it("Filters out malformed results - wrong object type", () => {
      let malformedEntry = [
        {displayName:"test",kmsiToken:"test"},
        {displayName:"testMalformed", kmsiToken:123},
        {displayName:{subobject:"true"}, kmsiToken:"test"}
      ];
      dummyStore.setItem(KMSI_STORE_KEY, JSON.stringify(malformedEntry));
      let storedKMSI = getExistingKmsi();
      let expectedResult = [{displayName:"test",kmsiToken:"test"}];
      expect(storedKMSI).to.deep.equal(expectedResult);
    });

    it("Clears the storage if the stored item is malformed - Valid JSON", () => {
      let malformedEntry = {displayName:"notArray",kmsiToken:"test"};
      dummyStore.setItem(KMSI_STORE_KEY, JSON.stringify(malformedEntry));
      let storedKMSI = getExistingKmsi();
      let expectedResult = [];
      expect(storedKMSI).to.deep.equal(expectedResult);
      expect(dummyStore.getItem(KMSI_STORE_KEY)).to.not.exist;
    });

    it("Clears the storage if the stored item is malformed - Malformed JSON", () => {
      let malformedEntry = "{displayName:";
      dummyStore.setItem(KMSI_STORE_KEY, malformedEntry);
      let storedKMSI = getExistingKmsi();
      let expectedResult = [];
      expect(storedKMSI).to.deep.equal(expectedResult);
      expect(dummyStore.getItem(KMSI_STORE_KEY)).to.not.exist;
    });
  });

  describe("Store KMSI", () => {
    it("Creates a new entry for an inital item", () => {
      let newEntry = {displayName:"test",kmsiToken:"test"};
      storeKmsiSetting(newEntry);
      expect(dummyStore.getItem(KMSI_STORE_KEY)).to.equal(`[${JSON.stringify(newEntry)}]`);
    });

    it("Appends a new entry to an existing stored entry", () => {
      dummyStore.setItem(KMSI_STORE_KEY, '[{"displayName":"existingEntry","kmsiToken":"test"}]');
      let newEntry = {displayName:"test",kmsiToken:"test"};
      storeKmsiSetting(newEntry);
      expect(dummyStore.getItem(KMSI_STORE_KEY)).to.equal(`[{"displayName":"existingEntry","kmsiToken":"test"},${JSON.stringify(newEntry)}]`);
    });

    it("Overrides an existing entry of the same name", () => {
      dummyStore.setItem(KMSI_STORE_KEY, '[{displayName:"test",kmsiToken:"test1"}]');
      let newEntry = {displayName:"test",kmsiToken:"test2"};
      storeKmsiSetting(newEntry);
      expect(dummyStore.getItem(KMSI_STORE_KEY)).to.equal(`[${JSON.stringify(newEntry)}]`);
    });

    it("Removes existing malformed entries on insert - Valid JSON", () => {
      dummyStore.setItem(KMSI_STORE_KEY, `[{"test":"test"}]`);
      let newEntry = {displayName:"test",kmsiToken:"test"};
      storeKmsiSetting(newEntry);
      expect(dummyStore.getItem(KMSI_STORE_KEY)).to.equal(`[${JSON.stringify(newEntry)}]`);
    });

    it("Removes existing malformed entries on insert - Invalid JSON", () => {
      dummyStore.setItem(KMSI_STORE_KEY, "Just a string");
      let newEntry = {displayName:"test",kmsiToken:"test"};
      storeKmsiSetting(newEntry);
      expect(dummyStore.getItem(KMSI_STORE_KEY)).to.equal(`[${JSON.stringify(newEntry)}]`);
    });
  });

  describe("Clear KMSI", () => {
    it("Handles an empty store", () => {
      let toClearEntry = {displayName:"test",kmsiToken:""};
      clearKmsiEntry(toClearEntry);
      expect(dummyStore.getItem(KMSI_STORE_KEY)).to.not.exist;
    });

    it("Clears one entry from the stored array", () => {
      let existingEntries = [{displayName:"test",kmsiToken:"test"},{displayName:"test1",kmsiToken:"test1"}];
      dummyStore.setItem(KMSI_STORE_KEY, JSON.stringify(existingEntries));
      let toClearEntry = {displayName:"test",kmsiToken:"test"};
      clearKmsiEntry(toClearEntry);
      expect(dummyStore.getItem(KMSI_STORE_KEY)).to.equal('[{"displayName":"test1","kmsiToken":"test1"}]');
    });

    it("Removes a malformed entries when clearing - Valid JSON", () => {
      dummyStore.setItem(KMSI_STORE_KEY, JSON.stringify([{test:"test"}, {displayName:"test",kmsiToken:"test"}, {displayName:"test1",kmsiToken:"test1"}]));
      let toClearEntry = {displayName:"test",kmsiToken:"test"};
      clearKmsiEntry(toClearEntry);
      expect(dummyStore.getItem(KMSI_STORE_KEY)).to.equal('[{"displayName":"test1","kmsiToken":"test1"}]');
    });

    it("Removes a malformed storage entry entirely - Valid JSON, invalid Object", () => {
      dummyStore.setItem(KMSI_STORE_KEY, '{"value":"Just a string"}');
      let toClearEntry = {displayName:"test",kmsiToken:"test"};
      clearKmsiEntry(toClearEntry);
      expect(dummyStore.getItem(KMSI_STORE_KEY)).to.not.exist;
    });

    it("Removes a malformed storage entry entirely - Invalid JSON", () => {
      dummyStore.setItem(KMSI_STORE_KEY, "{Malformed");
      let toClearEntry = {displayName:"test",kmsiToken:"test"};
      clearKmsiEntry(toClearEntry);
      expect(dummyStore.getItem(KMSI_STORE_KEY)).to.not.exist;
    });
  });
});