import jestCommon from "./jest.common";

export default {
  ...jestCommon,
  testRegex: "integration.(test|spec).mts",
};
