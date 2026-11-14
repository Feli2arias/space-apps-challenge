import { describe, expect, it } from "vitest";
import { toPlaceName, toPlaceResults } from "./nominatim";

/** Trimmed copy of a real answer for "Los Chiles, Costa Rica" (2026-11-14). */
const REAL_ANSWER = [
  {
    place_id: 309927001,
    licence: "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright",
    osm_type: "relation",
    osm_id: 6193364,
    lat: "10.8570354",
    lon: "-84.7150178",
    category: "boundary",
    type: "administrative",
    place_rank: 12,
    importance: 0.43133189964742946,
    addresstype: "county",
    name: "Los Chiles",
    display_name: "Los Chiles, Alajuela, Costa Rica",
    boundingbox: ["10.6294021", "11.0843785", "-84.8960996", "-84.4515587"],
  },
  {
    place_id: 310510478,
    licence: "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright",
    osm_type: "relation",
    osm_id: 6336274,
    lat: "11.0334758",
    lon: "-84.7153035",
    category: "boundary",
    type: "administrative",
    place_rank: 16,
    importance: 0.36001248335965585,
    addresstype: "town",
    name: "Los Chiles",
    display_name: "Los Chiles, Alajuela, 21401, Costa Rica",
    boundingbox: ["10.8438243", "11.0843785", "-84.7466733", "-84.4515587"],
  },
];

describe("toPlaceResults", () => {
  it("reads coordinates as numbers and keeps the kind of place", () => {
    expect(toPlaceResults(REAL_ANSWER)).toEqual([
      {
        name: "Los Chiles",
        displayName: "Los Chiles, Alajuela, Costa Rica",
        lat: 10.8570354,
        lon: -84.7150178,
        kind: "county",
      },
      {
        name: "Los Chiles",
        displayName: "Los Chiles, Alajuela, 21401, Costa Rica",
        lat: 11.0334758,
        lon: -84.7153035,
        kind: "town",
      },
    ]);
  });

  it("returns an empty list when nothing was found", () => {
    expect(toPlaceResults([])).toEqual([]);
  });

  it("uses the first part of the description when the name is empty", () => {
    const [place] = toPlaceResults([{ display_name: "Upala, Alajuela, Costa Rica", lat: "10.9", lon: "-85.0", name: "" }]);
    expect(place.name).toBe("Upala");
    expect(place.kind).toBe("place");
  });

  it("drops entries whose coordinates are not numbers", () => {
    expect(toPlaceResults([{ display_name: "Nowhere", lat: "north", lon: "-85.0" }])).toEqual([]);
  });

  it("rejects an answer that is not a list of places", () => {
    expect(() => toPlaceResults({ error: "Unable to geocode" })).toThrow(/unexpected format/);
  });
});

/** Real answer of the reverse lookup for lat 10.95, lon -84.72 (2026-11-14). */
const REAL_REVERSE = {
  place_id: 310510478,
  licence: "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright",
  osm_type: "relation",
  osm_id: 6336274,
  lat: "11.0334758",
  lon: "-84.7153035",
  category: "boundary",
  type: "administrative",
  place_rank: 16,
  importance: 0.36001248335965585,
  addresstype: "town",
  name: "Los Chiles",
  display_name: "Los Chiles, Alajuela, 21401, Costa Rica",
  address: {
    town: "Los Chiles",
    county: "Los Chiles",
    state: "Alajuela",
    "ISO3166-2-lvl4": "CR-A",
    postcode: "21401",
    country: "Costa Rica",
    country_code: "cr",
  },
  boundingbox: ["10.8438243", "11.0843785", "-84.7466733", "-84.4515587"],
};

describe("toPlaceName", () => {
  it("names the town, the region and the country", () => {
    expect(toPlaceName(REAL_REVERSE)).toEqual({
      country: "Costa Rica",
      countryCode: "CR",
      region: "Alajuela",
      locality: "Los Chiles",
    });
  });

  it("returns an unknown place for a point with no name, such as open sea", () => {
    // Real answer for lat 8.0, lon -95.0.
    expect(toPlaceName({ error: "Unable to geocode" })).toEqual({
      country: null,
      countryCode: null,
      region: null,
      locality: null,
    });
  });

  it("falls back to the county when there is no town, and leaves missing parts empty", () => {
    expect(toPlaceName({ address: { county: "Upala", country: "Costa Rica" } })).toEqual({
      country: "Costa Rica",
      countryCode: null,
      region: null,
      locality: "Upala",
    });
  });

  it("rejects an answer in another shape", () => {
    expect(() => toPlaceName([])).toThrow(/unexpected format/);
  });
});
