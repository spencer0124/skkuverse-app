/**
 * The served stations: `GET /subway/stations`. `stations.json` is the
 * server's contract fixture (`contracts/produced/fixtures/subway-station-list.subwayStationList/all-stations.json`,
 * server dev `8f3c67c2`, re-vendored 2026-10-25 with 사당, 금정 and 종로5가, whose campus is null), the eleven
 * stations with their campus and coords; production answered the first eight on 2026-10-24.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { parseOrThrow, setDropReporter } from '@skkuverse/shared';
import { subwayStationsSchema } from './subway.schema';
import stations from './__fixtures__/stations.json';

const reports: [string, number][] = [];
setDropReporter((where, index) => reports.push([where, index]));
afterEach(() => {
  reports.length = 0;
});

type RawStation = Record<string, unknown> & { lines: Record<string, unknown>[] };

const parseStations = (data: unknown) => parseOrThrow(subwayStationsSchema, data, 'subway stations');

/** The fixture's data with its stations edited by `edit`. */
function editedData(edit: (stations: RawStation[]) => void): unknown {
  const data = structuredClone(stations.data) as { stations: RawStation[] };
  edit(data.stations);
  return data;
}

describe('the subway station list', () => {
  it('reads every served station in the server order, and reports no drop', () => {
    // Act
    const out = parseStations(stations.data);

    // Assert
    expect(out.map((s) => s.id)).toEqual([
      'sungkyunkwan',
      'hyehwa',
      'jeongja',
      'jamsil',
      'dogok',
      'gangnam',
      'yangjae',
      'gwanggyo-jungang',
      'sadang',
      'geumjeong',
      'jongno-5-ga',
      'migeum',
      'bokjeong',
      'garak-market',
      'songpa',
    ]);
    expect(reports).toStrictEqual([]);
  });

  it('reads a station as its slug, title, lines and coords', () => {
    // Act
    const jeongja = parseStations(stations.data).find((s) => s.id === 'jeongja');

    // Assert
    expect(jeongja).toEqual({
      id: 'jeongja',
      title: '정자역',
      lines: [
        { code: 'D1', name: '신분당선', color: 'D4003B', marker: { text: '신', color: 'D4003B' } },
        { code: 'K1', name: '수인분당선', color: 'F5A200', marker: { text: '수', color: 'A26B00' } },
      ],
      campus: 'nsc',
      coords: { lat: 37.366546, lng: 127.108237 },
    });
  });

  it('reads the campus each station is served with', () => {
    // Act
    const campuses = parseStations(stations.data).map((s) => [s.id, s.campus]);

    // Assert
    expect(campuses).toEqual([
      ['sungkyunkwan', 'nsc'],
      ['hyehwa', 'hssc'],
      ['jeongja', 'nsc'],
      ['jamsil', 'nsc'],
      ['dogok', 'nsc'],
      ['gangnam', 'nsc'],
      ['yangjae', 'nsc'],
      ['gwanggyo-jungang', 'nsc'],
      ['sadang', null],
      ['geumjeong', null],
      ['jongno-5-ga', null],
      ['migeum', null],
      ['bokjeong', null],
      ['garak-market', null],
      ['songpa', null],
    ]);
  });

  it('reads an absent or unknown campus as null, meaning both, and keeps the station', () => {
    // Arrange
    const data = editedData((list) => {
      delete list[0]!.campus;
      list[1]!.campus = 'songdo';
      list[2]!.campus = null;
    });

    // Act
    const out = parseStations(data);

    // Assert
    expect(out.slice(0, 3).map((s) => [s.id, s.campus])).toEqual([
      ['sungkyunkwan', null],
      ['hyehwa', null],
      ['jeongja', null],
    ]);
    expect(reports).toStrictEqual([]);
  });

  it('keeps a station whose coords are null, as the server lists one it has none for', () => {
    // Arrange
    const data = editedData((list) => {
      list[1]!.coords = null;
    });

    // Act
    const hyehwa = parseStations(data)[1];

    // Assert
    expect(hyehwa).toMatchObject({ id: 'hyehwa', coords: null });
  });

  it('drops a station with no slug or no title, alone', () => {
    // Arrange
    const data = editedData((list) => {
      delete list[0]!.id;
      list[1]!.title = '';
    });

    // Act & Assert
    expect(parseStations(data).map((s) => s.id)).toEqual([
      'jeongja',
      'jamsil',
      'dogok',
      'gangnam',
      'yangjae',
      'gwanggyo-jungang',
      'sadang',
      'geumjeong',
      'jongno-5-ga',
      'migeum',
      'bokjeong',
      'garak-market',
      'songpa',
    ]);
  });

  it('drops a line whose display data is broken, and keeps the station', () => {
    // Arrange
    const data = editedData((list) => {
      list[2]!.lines[0]!.marker = null;
    });

    // Act & Assert
    expect(parseStations(data)[2]?.lines.map((l) => l.code)).toEqual(['K1']);
  });

  it('reads a list that is not a list as no stations', () => {
    // Act & Assert
    expect(parseStations({ stations: 'all' })).toEqual([]);
    expect(parseStations(null)).toEqual([]);
  });
});
