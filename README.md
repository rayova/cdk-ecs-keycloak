# Keycloak Cluster Construct

This CDK construct allows you spin up a HA Keycloak cluster on AWS ECS.

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

**Auto-scaling example with SSL and keycloak configuration**

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
  httpsListenerProvider: keycloak.ListenerProvider.https({
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
  scaleInCooldown: cdk.Duration.minutes(30),
  scaleOutCooldown: cdk.Duration.minutes(10),
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
