import * as rds from '@aws-cdk/aws-rds';
import { KeycloakDatabaseVendor, mapEngineToKeycloakVendor } from '../../src';

describe('database info', () => {
  describe('maps cluster engines', () => {
    test.each([
      [rds.DatabaseClusterEngine.AURORA_MYSQL, KeycloakDatabaseVendor.MYSQL],
      [rds.DatabaseClusterEngine.AURORA_POSTGRESQL, KeycloakDatabaseVendor.POSTGRES],
      [rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_0 }), KeycloakDatabaseVendor.MYSQL],
      [rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_5_7 }), KeycloakDatabaseVendor.MYSQL],
      [rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_9_5 }), KeycloakDatabaseVendor.POSTGRES],
    ])('%s => %s', (from, to) => {
      expect(mapEngineToKeycloakVendor(from)).toEqual(to);
    });

    test('throws on unrecognized engine', () => {
      expect(() => mapEngineToKeycloakVendor({
        engineType: 'UNKNOWN',
        engineFamily: 'UNKNOWN',
      }));
    });
  });
});

