# CDK-based Keycloak Cluster on ECS

This CDK construct allows you to spin up a high availability Keycloak cluster on AWS ECS using Fargate capacity.

* [API Reference](https://github.com/wheatstalk/cdk-ecs-keycloak/blob/master/API.md)
* [Changelog](https://github.com/wheatstalk/cdk-ecs-keycloak/blob/master/CHANGELOG.md)

## What is Keycloak?

Keycloak is an open-source identity and access management server. With it, you can add authentication to your apps and secure services with little fuss.

## But why Keycloak on ECS over Cognito?

- Account linking doesn't break down in Keycloak when the user signed up with a social account and now wants to set a password
- User-oriented account management console
- More user federation, identity brokering, and social login features
- Store and access the user's federated access tokens on other services

## Examples

### All defaults

The simplest example shows all defaults below.

```ts
import * as keycloak from '@wheatstalk/cdk-ecs-keycloak';
import * as cdk from '@aws-cdk/core';

// Create a CDK app and a stack
const app = new cdk.App();
const stack = new cdk.Stack(app, 'Keycloak-test');

// Add a Keycloak cluster to the stack
new keycloak.KeycloakCluster(stack, 'Keycloak');
```

The initial deployment takes a few minutes, after which a URL to Keycloak will be shown in the terminal. After a few minutes of settling, Keycloak will be available at that URL.

By default, all the following are created:

- A VPC (public and private subnet with nat gateways)
- An Internet-facing load balancer serving HTTP (not HTTPS) traffic
- An ECS cluster with Keycloak running on it
- An Aurora Serverless MySQL cluster

### Auto-scaling with internal HTTPS and Keycloak configuration

To demonstrate more functionality, here is an example cluster that does the following:

- Requests Fargate tasks sized 0.5vCPU / 1GB RAM
- Controls ECS deployment min and max health settings
- Sets up Infiniscan clustering by increasing cache owner count
- Publishes an Application Load Balancer with internal HTTPS
- The Application Load Balancer in this example upgrades HTTP connections to HTTPS
- Sets up auto-scaling by interacting directly with the ECS service

```ts
// Create a Keycloak cluster on Fargate
const keycloakCluster = new keycloak.KeycloakCluster(this, 'Keycloak', {
  // Fargate task sizes
  cpu: 512,
  memoryLimitMiB: 1024,
  // Service options
  minHealthyPercent: 50,
  maxHealthyPercent: 200,
  keycloak: {
    // Set distributed inficaches owners to two
    cacheOwnersCount: 2,
  },
  // Use an HTTPS load balancer with internal HTTPS from the load balancer to Keycloak.
  httpsPortPublisher: keycloak.PortPublisher.httpsAlb({
    certificates: [certificate],
    // Redirect HTTP traffic to HTTPS
    upgradeHttp: true,
  }),
});

// Auto-scale the service
const autoScaling = keycloakCluster.service.autoScaleTaskCount({
  maxCapacity: 5,
  minCapacity: 3,
});

autoScaling.scaleOnCpuUtilization('Target40', {
  targetUtilizationPercent: 40,
  scaleInCooldown: cdk.Duration.minutes(30),
  scaleOutCooldown: cdk.Duration.minutes(10),
});
```

### Use a database instance

You may opt to use a database instance instead of an Aurora Serverless cluster.

```ts
new keycloak.KeycloakCluster(this, 'Keycloak', {
  databaseProvider: keycloak.DatabaseProvider.databaseInstance({
    engine: rds.DatabaseInstanceEngine.mysql({
      version: rds.MysqlEngineVersion.VER_5_7,
    }),
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
  }),
});
```

### Use Postgres instead of MySQL

```ts
new keycloak.KeycloakCluster(this, 'Keycloak', {
  databaseProvider: keycloak.DatabaseProvider.databaseInstance({
    engine: rds.DatabaseInstanceEngine.postgres({
      version: rds.PostgresEngineVersion.VER_11_9,
    }),
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
  }),
});
```

### Provide your VPC and Application Load Balancer

You may provide resources you've created, such as VPCs, Clusters, CloudMap namespaces and load balancers. In the following
for example we re-use a VPC and Application Load Balancer listener. As a result:

- The cluster will provide a new ECS cluster and database in the given VPC.
- The cluster will publish its HTTP port on the given load balancer listener.

```ts
new keycloak.KeycloakCluster(this, 'Keycloak', {
  // Provide an existing VPC so the cluster and database can opt to reuse it
  vpcProvider: keycloak.VpcProvider.fromVpc(vpc),
  // Bring your own load balancer
  httpPortPublisher: keycloak.PortPublisher.addTarget({
    // Your load balancer's listener
    listener,
    // Answer based on a load balancer listener rule condition
    conditions: [elbv2.ListenerCondition.hostHeaders(['id.example.com'])],
    // Order the listener rule by priority
    priority: 1000,
  }),
});
```

> You may also provide a cluster and database. More is available in the API reference.

### Customize the container image

You may build and use a custom container image to add a custom theme, run scripts, add custom realm configs, or bundle your
own Keycloak SPIs.

```ts
new keycloak.KeycloakCluster(this, 'Keycloak', {
  keycloak: {
    image: ecs.ContainerImage.fromAsset(pathToDockerBuildContext, {
      buildArgs: {
        FROM: 'jboss/keycloak:12.0.2',
      },
    }),
  },
});
```

### Publish container ports through a Network Load Balancer

You may use the `PortPublisher` pattern to publish container ports through a Network Load Balancer.

```ts
new keycloak.KeycloakCluster(this, 'Keycloak', {
  // Publish the container's HTTP web port in a NLB on port 8080
  httpPortPublisher: keycloak.PortPublisher.nlb({
    port: 8080,
  }),
  // Publish the container's HTTPS port in an NLB on port 8443
  httpsPortPublisher: keycloak.PortPublisher.nlb({
    port: 8443,
    healthCheck: false,
  }),
  // Publish the Wildfly Admin Console on port 9990 (not recommended in
  // production)
  adminConsolePortPublisher: keycloak.PortPublisher.nlb({
    port: 9990,
    healthCheck: false,
  }),
});
```
