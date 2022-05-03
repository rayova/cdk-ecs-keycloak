import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as secrets from 'aws-cdk-lib/aws-secretsmanager';
import * as cloudmap from 'aws-cdk-lib/aws-servicediscovery';
import { KeycloakContainerExtension, KeycloakDatabaseVendor, mapDnsRecordTypeToJGroup } from '../src';

describe('mapDnsRecordTypeToJGroup', () => {
  test.each([
    [cloudmap.DnsRecordType.A, 'A'],
    [cloudmap.DnsRecordType.SRV, 'SRV'],
  ])('maps %s -> %s', (from, expected) => {
    expect(mapDnsRecordTypeToJGroup(from)).toEqual(expected);
  });

  test('throws on unrecognized record type', () => {
    expect(() => mapDnsRecordTypeToJGroup(cloudmap.DnsRecordType.AAAA)).toThrow(/unsupported/i);
  });
});

describe('KeycloakContainerExtension', () => {
  test('has consistent default values', () => {
    const task = new ecs.FargateTaskDefinition(new cdk.Stack(), 'TaskDefinition');
    const addContainerSpy = jest.spyOn(task, 'addContainer');
    const extension = new KeycloakContainerExtension();

    task.addExtension(extension);

    expect(addContainerSpy).toBeCalledWith('keycloak', expect.objectContaining({
      image: expect.objectContaining({
        imageName: 'jboss/keycloak',
      }),
      environment: expect.objectContaining({
        KEYCLOAK_USER: 'admin',
        KEYCLOAK_PASSWORD: 'admin',
        DB_NAME: '',
        DB_VENDOR: 'h2',
        CACHE_OWNERS_COUNT: '1',
        CACHE_OWNERS_AUTH_SESSIONS_COUNT: '1',
      }),
    }));
  });

  describe('default memory limits', () => {
    test('uses user-provided values', () => {
      const task = new ecs.Ec2TaskDefinition(new cdk.Stack(), 'TaskDefinition');
      const addContainerSpy = jest.spyOn(task, 'addContainer');
      const extension = new KeycloakContainerExtension({
        memoryLimitMiB: 10_000,
        memoryReservationMiB: 9_000,
      });

      task.addExtension(extension);

      expect(addContainerSpy).toBeCalledWith('keycloak', expect.objectContaining({
        memoryLimitMiB: 10_000,
        memoryReservationMiB: 9_000,
      }));
    });

    test('gets from task definition if available', () => {
      const task = new ecs.FargateTaskDefinition(new cdk.Stack(), 'TaskDefinition', {
        cpu: 512,
        memoryLimitMiB: 4096,
      });
      const addContainerSpy = jest.spyOn(task, 'addContainer');
      const extension = new KeycloakContainerExtension();

      task.addExtension(extension);

      expect(addContainerSpy).toBeCalledWith('keycloak', expect.objectContaining({
        memoryLimitMiB: 4096,
        memoryReservationMiB: Math.round(0.8 * 4096),
      }));
    });

    test('512MB unless specified', () => {
      const task = new ecs.Ec2TaskDefinition(new cdk.Stack(), 'TaskDefinition');
      const addContainerSpy = jest.spyOn(task, 'addContainer');
      const extension = new KeycloakContainerExtension();

      task.addExtension(extension);

      expect(addContainerSpy).toBeCalledWith('keycloak', expect.objectContaining({
        memoryLimitMiB: 512,
        memoryReservationMiB: Math.round(0.8 * 512),
      }));
    });
  });

  test('adds a keycloak container', () => {
    const task = new ecs.FargateTaskDefinition(new cdk.Stack(), 'TaskDefinition');
    const extension = new KeycloakContainerExtension();
    const addContainerSpy = jest.spyOn(task, 'addContainer');

    task.addExtension(extension);

    expect(addContainerSpy).toBeCalledWith('keycloak', expect.any(Object));
    expect(task.defaultContainer?.containerName).toEqual(extension.containerName);
    expect(task.defaultContainer?.containerPort).toEqual(8080);
  });

  test('adds a container by another name', () => {
    const task = new ecs.FargateTaskDefinition(new cdk.Stack(), 'TaskDefinition');
    const addContainerSpy = jest.spyOn(task, 'addContainer');
    const extension = new KeycloakContainerExtension({
      containerName: 'foobar',
    });

    task.addExtension(extension);

    expect(extension.containerName).toEqual('foobar');
    expect(addContainerSpy).toBeCalledWith('foobar', expect.any(Object));
    expect(task.defaultContainer?.containerName).toEqual('foobar');
  });

  test('allows custom cache counts', () => {
    const taskDefinition = new ecs.FargateTaskDefinition(new cdk.Stack(), 'TaskDefinition');
    const addContainerSpy = jest.spyOn(taskDefinition, 'addContainer');

    const extension = new KeycloakContainerExtension({
      cacheOwnersCount: 2,
      cacheOwnersAuthSessionsCount: 3,
    });

    taskDefinition.addExtension(extension);

    expect(extension.cacheOwnersCount).toEqual(2);
    expect(extension.cacheOwnersAuthSessionsCount).toEqual(3);
    expect(addContainerSpy).toBeCalledWith('keycloak', expect.objectContaining({
      environment: expect.objectContaining({
        CACHE_OWNERS_COUNT: '2',
        CACHE_OWNERS_AUTH_SESSIONS_COUNT: '3',
      }),
    }));
  });

  test('throws when infinicache clustering is disabled with custom cache counts', () => {
    expect(() => {
      new KeycloakContainerExtension({
        infinicacheClustering: false,
        cacheOwnersCount: 2,
        cacheOwnersAuthSessionsCount: 3,
      });
    }).toThrow(/clustering must be enabled/i);
  });

  test('allows custom default admin user/password', () => {
    const task = new ecs.FargateTaskDefinition(new cdk.Stack(), 'TaskDefinition');
    const addContainerSpy = jest.spyOn(task, 'addContainer');
    const extension = new KeycloakContainerExtension({
      defaultAdminUser: 'adminUser',
      defaultAdminPassword: 'adminPassword',
    });

    task.addExtension(extension);

    expect(addContainerSpy).toBeCalledWith('keycloak', expect.objectContaining({
      environment: expect.objectContaining({
        KEYCLOAK_USER: 'adminUser',
        KEYCLOAK_PASSWORD: 'adminPassword',
      }),
    }));
  });

  test('allows custom container image', () => {
    const task = new ecs.FargateTaskDefinition(new cdk.Stack(), 'TaskDefinition');
    const addContainerSpy = jest.spyOn(task, 'addContainer');
    const image = ecs.ContainerImage.fromRegistry('jboss/keycloak:12.0.1');
    const extension = new KeycloakContainerExtension({
      image: image,
    });

    task.addExtension(extension);

    expect(addContainerSpy).toBeCalledWith('keycloak', expect.objectContaining({
      image: image,
    }));
  });

  test('when unspecified, it sets the auth session count to the provided cache owner count', () => {
    const extension = new KeycloakContainerExtension({
      cacheOwnersCount: 5,
    });

    expect(extension.cacheOwnersAuthSessionsCount).toEqual(5);
  });

  test('accepts a custom logging driver', () => {
    const task = new ecs.FargateTaskDefinition(new cdk.Stack(), 'TaskDefinition');

    task.addExtension(
      new KeycloakContainerExtension({
        logging: new ecs.SyslogLogDriver(),
      }));

    expect(task.defaultContainer?.logDriverConfig?.logDriver).toEqual('syslog');
  });

  test('throws when credentials not present for non-h2 database vendor', () => {
    const task = new ecs.FargateTaskDefinition(new cdk.Stack(), 'TaskDefinition');

    expect(() => task.addExtension(
      new KeycloakContainerExtension({
        databaseVendor: KeycloakDatabaseVendor.MYSQL,
      })),
    ).toThrow(/requires credentials/i);
  });

  test('throws when using an unsupported database', () => {
    const task = new ecs.FargateTaskDefinition(new cdk.Stack(), 'TaskDefinition');

    expect(() => task.addExtension(
      new KeycloakContainerExtension({
        databaseVendor: KeycloakDatabaseVendor.ORACLE,
      })),
    ).toThrow(/supported/i);
  });

  test('adds credentials for mysql database', () => {
    const stack = new cdk.Stack();
    const databaseCredentials = new secrets.Secret(stack, 'Secret');
    const task = new ecs.FargateTaskDefinition(stack, 'TaskDefinition');

    const addContainerSpy = jest.spyOn(task, 'addContainer');
    const extension = new KeycloakContainerExtension({
      databaseVendor: KeycloakDatabaseVendor.MYSQL,
      databaseCredentials,
    });

    task.addExtension(extension);

    expect(addContainerSpy).toBeCalledWith('keycloak', expect.objectContaining({
      secrets: expect.objectContaining({
        DB_ADDR: expect.objectContaining({ arn: expect.stringContaining(':host') }),
        DB_PORT: expect.objectContaining({ arn: expect.stringContaining(':port') }),
        DB_USER: expect.objectContaining({ arn: expect.stringContaining(':username') }),
        DB_PASSWORD: expect.objectContaining({ arn: expect.stringContaining(':password') }),
      }),
    }));
  });

  test('allows custom database name', () => {
    const stack = new cdk.Stack();
    const task = new ecs.FargateTaskDefinition(stack, 'TaskDefinition');
    const addContainerSpy = jest.spyOn(task, 'addContainer');
    const databaseCredentials = new secrets.Secret(stack, 'Secret');
    const extension = new KeycloakContainerExtension({
      databaseVendor: KeycloakDatabaseVendor.MYSQL,
      databaseCredentials: databaseCredentials,
      databaseName: 'custom',
    });

    task.addExtension(extension);

    expect(addContainerSpy).toBeCalledWith('keycloak', expect.objectContaining({
      environment: expect.objectContaining({
        DB_NAME: 'custom',
      }),
    }));
  });

  describe('service discovery', () => {
    test('it defaults to JDBC_PING', () => {
      const stack = new cdk.Stack();
      const task = new ecs.FargateTaskDefinition(stack, 'TaskDefinition');

      const extension = new KeycloakContainerExtension({
        infinicacheClustering: true,
      });
      task.addExtension(extension);

      const res = Template.fromStack(stack).toJSON();
      // Yuck. Don't know another way to check for just these variables.
      const environment = res.Resources.TaskDefinitionB36D86D9.Properties.ContainerDefinitions[0].Environment;
      expect(environment).toEqual(expect.arrayContaining([
        {
          Name: 'JGROUPS_DISCOVERY_PROTOCOL',
          Value: 'JDBC_PING',
        },
        {
          Name: 'JGROUPS_DISCOVERY_PROPERTIES',
          Value: '',
        },
      ]));
    });

    test('it uses A records', () => {
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'Vpc');

      const cloudMapNamespace = new cloudmap.PrivateDnsNamespace(stack, 'CloudMapNamespace', {
        name: 'test',
        vpc,
      });
      const cloudMapService = new cloudmap.Service(stack, 'CloudMapService', {
        namespace: cloudMapNamespace,
        dnsRecordType: cloudmap.DnsRecordType.A,
      });
      const task = new ecs.FargateTaskDefinition(stack, 'TaskDefinition');

      const extension = new KeycloakContainerExtension({
        infinicacheClustering: true,
      });
      extension.useCloudMapService(cloudMapService);
      task.addExtension(extension);

      const res = Template.fromStack(stack).toJSON();
      // Yuck. Don't know another way to check for just these variables.
      const environment = res.Resources.TaskDefinitionB36D86D9.Properties.ContainerDefinitions[0].Environment;
      expect(environment).toEqual(expect.arrayContaining([
        {
          Name: 'JGROUPS_DISCOVERY_PROTOCOL',
          Value: 'dns.DNS_PING',
        },
        {
          Name: 'JGROUPS_DISCOVERY_PROPERTIES',
          Value: {
            'Fn::Sub': [
              'dns_query=${ServiceName}.${ServiceNamespace},dns_record_type=${QueryType}',
              {
                ServiceName: { 'Fn::GetAtt': ['CloudMapServiceACF140F2', 'Name'] },
                ServiceNamespace: 'test',
                QueryType: 'A',
              },
            ],
          },
        },
      ]));
    });

    test('it uses SRV records', () => {
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'Vpc');

      const cloudMapNamespace = new cloudmap.PrivateDnsNamespace(stack, 'CloudMapNamespace', {
        name: 'test',
        vpc,
      });
      const cloudMapService = new cloudmap.Service(stack, 'CloudMapService', {
        namespace: cloudMapNamespace,
        dnsRecordType: cloudmap.DnsRecordType.SRV,
      });
      const task = new ecs.FargateTaskDefinition(stack, 'TaskDefinition');

      const extension = new KeycloakContainerExtension({
        infinicacheClustering: true,
      });
      extension.useCloudMapService(cloudMapService);
      task.addExtension(extension);

      const res = Template.fromStack(stack).toJSON();
      // Yuck. Don't know another way to check for just these variables.
      const environment = res.Resources.TaskDefinitionB36D86D9.Properties.ContainerDefinitions[0].Environment;
      expect(environment).toEqual(expect.arrayContaining([
        {
          Name: 'JGROUPS_DISCOVERY_PROTOCOL',
          Value: 'dns.DNS_PING',
        },
        {
          Name: 'JGROUPS_DISCOVERY_PROPERTIES',
          Value: {
            'Fn::Sub': [
              'dns_query=${ServiceName}.${ServiceNamespace},dns_record_type=${QueryType}',
              {
                ServiceName: { 'Fn::GetAtt': ['CloudMapServiceACF140F2', 'Name'] },
                ServiceNamespace: 'test',
                QueryType: 'SRV',
              },
            ],
          },
        },
      ]));
    });
  });
});