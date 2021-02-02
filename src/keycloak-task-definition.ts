import * as ecs from '@aws-cdk/aws-ecs';
import * as cdk from '@aws-cdk/core';
import { EnsureMysqlDatabaseExtension } from './ensure-mysql-database-extension';
import {
  KeycloakContainerExtension,
  KeycloakContainerExtensionProps,
  KeycloakDatabaseVendor,
} from './keycloak-container-extension';

/**
 * A Keycloak task definition.
 */
export interface IKeycloakTaskDefinition {
  /** The Keycloak container extension */
  readonly keycloakContainerExtension: KeycloakContainerExtension;
}

/**
 * Props for `KeycloakFargateTaskDefinition`
 */
export interface KeycloakFargateTaskDefinitionProps extends ecs.FargateTaskDefinitionProps {
  /** Keycloak configuration */
  readonly keycloak?: KeycloakContainerExtensionProps;
}

/**
 * The details of a Keycloak task definition running on Fargate.
 */
export class KeycloakFargateTaskDefinition extends ecs.FargateTaskDefinition implements IKeycloakTaskDefinition {
  public readonly keycloakContainerExtension: KeycloakContainerExtension;

  constructor(scope: cdk.Construct, id: string, props: KeycloakFargateTaskDefinitionProps) {
    super(scope, id, props);
    this.keycloakContainerExtension = configureKeyCloak(this, props.keycloak);
  }
}

/**
 * Props for `KeycloakEc2TaskDefinition`
 */
export interface KeycloakEc2TaskDefinitionProps extends ecs.FargateTaskDefinitionProps {
  /** Keycloak configuration */
  readonly keycloak?: KeycloakContainerExtensionProps;
}

/**
 * The details of a Keycloak task definition running on EC2.
 */
export class KeycloakEc2TaskDefinition extends ecs.Ec2TaskDefinition implements IKeycloakTaskDefinition {
  public readonly keycloakContainerExtension: KeycloakContainerExtension;

  constructor(scope: cdk.Construct, id: string, props: KeycloakEc2TaskDefinitionProps) {
    super(scope, id, props);
    this.keycloakContainerExtension = configureKeyCloak(this, props.keycloak);
  }
}

function configureKeyCloak(task: ecs.TaskDefinition, keycloak?: KeycloakContainerExtensionProps) {
  const extension = new KeycloakContainerExtension(keycloak);
  task.addExtension(extension);

  if (keycloak?.databaseCredentials && extension.databaseVendor === KeycloakDatabaseVendor.MYSQL) {
    task.addExtension(
      new EnsureMysqlDatabaseExtension({
        databaseName: extension.databaseName,
        databaseCredentials: keycloak.databaseCredentials,
      }));
  }

  return extension;
}