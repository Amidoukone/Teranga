import { filterLocalServiceChoices } from "./serviceCatalog";

jest.mock("./api", () => ({ get: jest.fn() }));

const categories = [
  { id: 1, slug: "plomberie" },
  { id: 2, slug: "electricite" },
];

test("a configured country only displays locally available services", () => {
  const result = filterLocalServiceChoices(categories, {
    configured: true,
    catalog: [
      { definition: { legacyTradeCategoryId: 2, legacyServiceType: null } },
      { definition: { legacyTradeCategoryId: null, legacyServiceType: "errand" } },
    ],
  });
  expect(result.tradeCategories).toEqual([categories[1]]);
  expect(result.classicTypes).toEqual(["errand"]);
});

test("a historical country without projection keeps the legacy choices", () => {
  expect(filterLocalServiceChoices(categories, { configured: false })).toEqual({
    tradeCategories: categories,
    classicTypes: undefined,
  });
});
