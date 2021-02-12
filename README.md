# Keycloak Cluster Construct

This CDK construct allows you spin up a HA Keycloak cluster on AWS ECS. You may use either Fargate or EC2 Capacity.

> Note: For EC2 capacity, the ECS tasks require VPC networking.

## Examples

**Simplest example**

```ts
// Simplest example with all-defaults. Creates all of these:
// - A Vpc (public and private subnet with nat gateways)
// - An Internet-facing load balancer serving HTTP (not HTTPS) traffic
// - An ECS cluster with Keycloak running on it
// - An Aurora Serverless MySQL cluster
new keycloak.KeycloakCluster(this, 'Keycloak');
```

**Auto-scaling example with SSL**

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
    // Replicated inficaches have two owners
    cacheOwnersCount: 2,
  },
  // Listen on ECS
  listenerProvider: keycloak.ListenerProvider.https({
    certificates: [certificate],
  }),
});

// Auto-scale the service
const autoScaling = keycloakCluster.service.autoScaleTaskCount({
  maxCapacity: 5,
  minCapacity: 3,
});

autoScaling.scaleOnCpuUtilization('Target40', {
  targetUtilizationPercent: 40,
  scaleInCooldown: cdk.Duration.minutes(10),
  scaleOutCooldown: cdk.Duration.minutes(30),
});
```

**Bring your own load balancer & VPC**

```ts
new keycloak.KeycloakCluster(this, 'Keycloak', {
  // Provide an existing VPC so the cluster and database can opt to reuse it
  vpcProvider: keycloak.VpcProvider.fromExistingVpc(vpc),
  // Re-use the existing listener
  listenerProvider: keycloak.ListenerProvider.fromListenerInfo({
    // Your load blancer's listener
    listener,
    // Answer based on a load balancer listener rule condition
    conditions: [elbv2.ListenerCondition.hostHeaders(['id.example.com'])],
    // Order the listener rule by priority
    priority: 1000,
  }),
});
```