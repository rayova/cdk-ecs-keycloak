# API Reference

**Classes**

Name|Description
----|-----------
[EnsureMysqlDatabaseExtension](#wheatstalk-cdk-ecs-keycloak-ensuremysqldatabaseextension)|Ensures a MySQL database exists by adding an init container.
[KeycloakContainerExtension](#wheatstalk-cdk-ecs-keycloak-keycloakcontainerextension)|Adds a keycloak container to a task definition it.
[KeycloakEc2TaskDefinition](#wheatstalk-cdk-ecs-keycloak-keycloakec2taskdefinition)|The details of a Keycloak task definition running on EC2.
[KeycloakFargateTaskDefinition](#wheatstalk-cdk-ecs-keycloak-keycloakfargatetaskdefinition)|The details of a Keycloak task definition running on Fargate.


**Structs**

Name|Description
----|-----------
[EnsureMysqlDatabaseExtensionProps](#wheatstalk-cdk-ecs-keycloak-ensuremysqldatabaseextensionprops)|Props for EnsureMysqlDatabaseExtension.
[KeycloakContainerExtensionProps](#wheatstalk-cdk-ecs-keycloak-keycloakcontainerextensionprops)|*No description*
[KeycloakEc2TaskDefinitionProps](#wheatstalk-cdk-ecs-keycloak-keycloakec2taskdefinitionprops)|Props for `KeycloakEc2TaskDefinition`.
[KeycloakFargateTaskDefinitionProps](#wheatstalk-cdk-ecs-keycloak-keycloakfargatetaskdefinitionprops)|Props for `KeycloakFargateTaskDefinition`.


**Interfaces**

Name|Description
----|-----------
[IKeycloakTaskDefinition](#wheatstalk-cdk-ecs-keycloak-ikeycloaktaskdefinition)|A Keycloak task definition.


**Enums**

Name|Description
----|-----------
[KeycloakDatabaseVendor](#wheatstalk-cdk-ecs-keycloak-keycloakdatabasevendor)|*No description*



## class EnsureMysqlDatabaseExtension  <a id="wheatstalk-cdk-ecs-keycloak-ensuremysqldatabaseextension"></a>

Ensures a MySQL database exists by adding an init container.

Makes the default container
depend on the successful completion of this container.

__Implements__: [ITaskDefinitionExtension](#aws-cdk-aws-ecs-itaskdefinitionextension)

### Initializer




```ts
new EnsureMysqlDatabaseExtension(props: EnsureMysqlDatabaseExtensionProps)
```

* **props** (<code>[EnsureMysqlDatabaseExtensionProps](#wheatstalk-cdk-ecs-keycloak-ensuremysqldatabaseextensionprops)</code>)  *No description*
  * **databaseCredentials** (<code>[ISecret](#aws-cdk-aws-secretsmanager-isecret)</code>)  RDS credentials. 
  * **databaseName** (<code>string</code>)  Name of the database to create. 
  * **containerName** (<code>string</code>)  Name of the container to add to do this work. __*Default*__: 'ensure-mysql-database'


### Methods


#### extend(taskDefinition) <a id="wheatstalk-cdk-ecs-keycloak-ensuremysqldatabaseextension-extend"></a>

Apply the extension to the given TaskDefinition.

```ts
extend(taskDefinition: TaskDefinition): void
```

* **taskDefinition** (<code>[TaskDefinition](#aws-cdk-aws-ecs-taskdefinition)</code>)  *No description*






## class KeycloakContainerExtension  <a id="wheatstalk-cdk-ecs-keycloak-keycloakcontainerextension"></a>

Adds a keycloak container to a task definition it.

To use ECS service
discovery to locate cluster members, you need to call `useCloudMapService`
with the CloudMap service so that we can configure the correct DNS query.
Without CloudMap service discovery, the default will be to use JDBC_ping.

__Implements__: [ITaskDefinitionExtension](#aws-cdk-aws-ecs-itaskdefinitionextension)

### Initializer




```ts
new KeycloakContainerExtension(props?: KeycloakContainerExtensionProps)
```

* **props** (<code>[KeycloakContainerExtensionProps](#wheatstalk-cdk-ecs-keycloak-keycloakcontainerextensionprops)</code>)  *No description*
  * **cacheOwnersAuthSessionsCount** (<code>number</code>)  The number of distributed cache owners for authentication sessions. __*Default*__: same as `cacheOwnersCount`
  * **cacheOwnersCount** (<code>number</code>)  The default number of distributed cache owners for each key. __*Default*__: 1
  * **containerName** (<code>string</code>)  A name for the container added to the task definition. __*Default*__: 'keycloak'
  * **databaseCredentials** (<code>[ISecret](#aws-cdk-aws-secretsmanager-isecret)</code>)  Secrets manager secret containing the RDS database credentials and connection information in JSON format. __*Default*__: none
  * **databaseName** (<code>string</code>)  Database name. __*Default*__: 'keycloak'
  * **databaseVendor** (<code>[KeycloakDatabaseVendor](#wheatstalk-cdk-ecs-keycloak-keycloakdatabasevendor)</code>)  The database vendor. __*Default*__: KeycloakDatabaseVendor.H2
  * **defaultAdminPassword** (<code>string</code>)  Default admin user's password. __*Default*__: 'admin'
  * **defaultAdminUser** (<code>string</code>)  Default admin user. __*Default*__: 'admin'



### Properties


Name | Type | Description 
-----|------|-------------
**cacheOwnersAuthSessionsCount** | <code>number</code> | The number of distributed auth session cache owners for each key.
**cacheOwnersCount** | <code>number</code> | The number of distributed cache owners for each key.
**containerName** | <code>string</code> | Name of the container added to the task definition.
**databaseName** | <code>string</code> | Name of the Keycloak database.
**databaseVendor** | <code>string</code> | Database vendor name.
**defaultAdminPassword** | <code>string</code> | The default admin user password.
**defaultAdminUser** | <code>string</code> | The default admin user's name.

### Methods


#### extend(taskDefinition) <a id="wheatstalk-cdk-ecs-keycloak-keycloakcontainerextension-extend"></a>

Apply the extension to the given TaskDefinition.

```ts
extend(taskDefinition: TaskDefinition): void
```

* **taskDefinition** (<code>[TaskDefinition](#aws-cdk-aws-ecs-taskdefinition)</code>)  *No description*




#### useCloudMapService(serviceDiscovery) <a id="wheatstalk-cdk-ecs-keycloak-keycloakcontainerextension-usecloudmapservice"></a>

Inform Keycloak of a CloudMap service discovery mechanism.

```ts
useCloudMapService(serviceDiscovery: IService): void
```

* **serviceDiscovery** (<code>[IService](#aws-cdk-aws-servicediscovery-iservice)</code>)  *No description*






## class KeycloakEc2TaskDefinition  <a id="wheatstalk-cdk-ecs-keycloak-keycloakec2taskdefinition"></a>

The details of a Keycloak task definition running on EC2.

__Implements__: [IConstruct](#constructs-iconstruct), [IConstruct](#aws-cdk-core-iconstruct), [IConstruct](#constructs-iconstruct), [IDependable](#aws-cdk-core-idependable), [IResource](#aws-cdk-core-iresource), [IConstruct](#constructs-iconstruct), [IDependable](#aws-cdk-core-idependable), [IConstruct](#aws-cdk-core-iconstruct), [ITaskDefinition](#aws-cdk-aws-ecs-itaskdefinition), [IConstruct](#constructs-iconstruct), [IDependable](#aws-cdk-core-idependable), [IConstruct](#aws-cdk-core-iconstruct), [IResource](#aws-cdk-core-iresource), [IEc2TaskDefinition](#aws-cdk-aws-ecs-iec2taskdefinition), [IConstruct](#constructs-iconstruct), [IDependable](#aws-cdk-core-idependable), [IConstruct](#aws-cdk-core-iconstruct), [IResource](#aws-cdk-core-iresource), [ITaskDefinition](#aws-cdk-aws-ecs-itaskdefinition), [IKeycloakTaskDefinition](#wheatstalk-cdk-ecs-keycloak-ikeycloaktaskdefinition)
__Extends__: [Ec2TaskDefinition](#aws-cdk-aws-ecs-ec2taskdefinition)

### Initializer




```ts
new KeycloakEc2TaskDefinition(scope: Construct, id: string, props: KeycloakEc2TaskDefinitionProps)
```

* **scope** (<code>[Construct](#aws-cdk-core-construct)</code>)  *No description*
* **id** (<code>string</code>)  *No description*
* **props** (<code>[KeycloakEc2TaskDefinitionProps](#wheatstalk-cdk-ecs-keycloak-keycloakec2taskdefinitionprops)</code>)  *No description*
  * **executionRole** (<code>[IRole](#aws-cdk-aws-iam-irole)</code>)  The name of the IAM task execution role that grants the ECS agent to call AWS APIs on your behalf. __*Default*__: An execution role will be automatically created if you use ECR images in your task definition.
  * **family** (<code>string</code>)  The name of a family that this task definition is registered to. __*Default*__: Automatically generated name.
  * **proxyConfiguration** (<code>[ProxyConfiguration](#aws-cdk-aws-ecs-proxyconfiguration)</code>)  The configuration details for the App Mesh proxy. __*Default*__: No proxy configuration.
  * **taskRole** (<code>[IRole](#aws-cdk-aws-iam-irole)</code>)  The name of the IAM role that grants containers in the task permission to call AWS APIs on your behalf. __*Default*__: A task role is automatically created for you.
  * **volumes** (<code>Array<[Volume](#aws-cdk-aws-ecs-volume)></code>)  The list of volume definitions for the task. __*Default*__: No volumes are passed to the Docker daemon on a container instance.
  * **cpu** (<code>number</code>)  The number of cpu units used by the task. __*Default*__: 256
  * **memoryLimitMiB** (<code>number</code>)  The amount (in MiB) of memory used by the task. __*Default*__: 512
  * **keycloak** (<code>[KeycloakContainerExtensionProps](#wheatstalk-cdk-ecs-keycloak-keycloakcontainerextensionprops)</code>)  Keycloak configuration. __*Optional*__



### Properties


Name | Type | Description 
-----|------|-------------
**keycloakContainerExtension** | <code>[KeycloakContainerExtension](#wheatstalk-cdk-ecs-keycloak-keycloakcontainerextension)</code> | The Keycloak container extension.



## class KeycloakFargateTaskDefinition  <a id="wheatstalk-cdk-ecs-keycloak-keycloakfargatetaskdefinition"></a>

The details of a Keycloak task definition running on Fargate.

__Implements__: [IConstruct](#constructs-iconstruct), [IConstruct](#aws-cdk-core-iconstruct), [IConstruct](#constructs-iconstruct), [IDependable](#aws-cdk-core-idependable), [IResource](#aws-cdk-core-iresource), [IConstruct](#constructs-iconstruct), [IDependable](#aws-cdk-core-idependable), [IConstruct](#aws-cdk-core-iconstruct), [ITaskDefinition](#aws-cdk-aws-ecs-itaskdefinition), [IConstruct](#constructs-iconstruct), [IDependable](#aws-cdk-core-idependable), [IConstruct](#aws-cdk-core-iconstruct), [IResource](#aws-cdk-core-iresource), [IFargateTaskDefinition](#aws-cdk-aws-ecs-ifargatetaskdefinition), [IConstruct](#constructs-iconstruct), [IDependable](#aws-cdk-core-idependable), [IConstruct](#aws-cdk-core-iconstruct), [IResource](#aws-cdk-core-iresource), [ITaskDefinition](#aws-cdk-aws-ecs-itaskdefinition), [IKeycloakTaskDefinition](#wheatstalk-cdk-ecs-keycloak-ikeycloaktaskdefinition)
__Extends__: [FargateTaskDefinition](#aws-cdk-aws-ecs-fargatetaskdefinition)

### Initializer




```ts
new KeycloakFargateTaskDefinition(scope: Construct, id: string, props: KeycloakFargateTaskDefinitionProps)
```

* **scope** (<code>[Construct](#aws-cdk-core-construct)</code>)  *No description*
* **id** (<code>string</code>)  *No description*
* **props** (<code>[KeycloakFargateTaskDefinitionProps](#wheatstalk-cdk-ecs-keycloak-keycloakfargatetaskdefinitionprops)</code>)  *No description*
  * **executionRole** (<code>[IRole](#aws-cdk-aws-iam-irole)</code>)  The name of the IAM task execution role that grants the ECS agent to call AWS APIs on your behalf. __*Default*__: An execution role will be automatically created if you use ECR images in your task definition.
  * **family** (<code>string</code>)  The name of a family that this task definition is registered to. __*Default*__: Automatically generated name.
  * **proxyConfiguration** (<code>[ProxyConfiguration](#aws-cdk-aws-ecs-proxyconfiguration)</code>)  The configuration details for the App Mesh proxy. __*Default*__: No proxy configuration.
  * **taskRole** (<code>[IRole](#aws-cdk-aws-iam-irole)</code>)  The name of the IAM role that grants containers in the task permission to call AWS APIs on your behalf. __*Default*__: A task role is automatically created for you.
  * **volumes** (<code>Array<[Volume](#aws-cdk-aws-ecs-volume)></code>)  The list of volume definitions for the task. __*Default*__: No volumes are passed to the Docker daemon on a container instance.
  * **cpu** (<code>number</code>)  The number of cpu units used by the task. __*Default*__: 256
  * **memoryLimitMiB** (<code>number</code>)  The amount (in MiB) of memory used by the task. __*Default*__: 512
  * **keycloak** (<code>[KeycloakContainerExtensionProps](#wheatstalk-cdk-ecs-keycloak-keycloakcontainerextensionprops)</code>)  Keycloak configuration. __*Optional*__



### Properties


Name | Type | Description 
-----|------|-------------
**keycloakContainerExtension** | <code>[KeycloakContainerExtension](#wheatstalk-cdk-ecs-keycloak-keycloakcontainerextension)</code> | The Keycloak container extension.



## struct EnsureMysqlDatabaseExtensionProps  <a id="wheatstalk-cdk-ecs-keycloak-ensuremysqldatabaseextensionprops"></a>


Props for EnsureMysqlDatabaseExtension.



Name | Type | Description 
-----|------|-------------
**databaseCredentials** | <code>[ISecret](#aws-cdk-aws-secretsmanager-isecret)</code> | RDS credentials.
**databaseName** | <code>string</code> | Name of the database to create.
**containerName**? | <code>string</code> | Name of the container to add to do this work.<br/>__*Default*__: 'ensure-mysql-database'



## interface IKeycloakTaskDefinition  <a id="wheatstalk-cdk-ecs-keycloak-ikeycloaktaskdefinition"></a>

__Implemented by__: [KeycloakEc2TaskDefinition](#wheatstalk-cdk-ecs-keycloak-keycloakec2taskdefinition), [KeycloakFargateTaskDefinition](#wheatstalk-cdk-ecs-keycloak-keycloakfargatetaskdefinition)

A Keycloak task definition.

### Properties


Name | Type | Description 
-----|------|-------------
**keycloakContainerExtension** | <code>[KeycloakContainerExtension](#wheatstalk-cdk-ecs-keycloak-keycloakcontainerextension)</code> | The Keycloak container extension.



## struct KeycloakContainerExtensionProps  <a id="wheatstalk-cdk-ecs-keycloak-keycloakcontainerextensionprops"></a>






Name | Type | Description 
-----|------|-------------
**cacheOwnersAuthSessionsCount**? | <code>number</code> | The number of distributed cache owners for authentication sessions.<br/>__*Default*__: same as `cacheOwnersCount`
**cacheOwnersCount**? | <code>number</code> | The default number of distributed cache owners for each key.<br/>__*Default*__: 1
**containerName**? | <code>string</code> | A name for the container added to the task definition.<br/>__*Default*__: 'keycloak'
**databaseCredentials**? | <code>[ISecret](#aws-cdk-aws-secretsmanager-isecret)</code> | Secrets manager secret containing the RDS database credentials and connection information in JSON format.<br/>__*Default*__: none
**databaseName**? | <code>string</code> | Database name.<br/>__*Default*__: 'keycloak'
**databaseVendor**? | <code>[KeycloakDatabaseVendor](#wheatstalk-cdk-ecs-keycloak-keycloakdatabasevendor)</code> | The database vendor.<br/>__*Default*__: KeycloakDatabaseVendor.H2
**defaultAdminPassword**? | <code>string</code> | Default admin user's password.<br/>__*Default*__: 'admin'
**defaultAdminUser**? | <code>string</code> | Default admin user.<br/>__*Default*__: 'admin'



## struct KeycloakEc2TaskDefinitionProps  <a id="wheatstalk-cdk-ecs-keycloak-keycloakec2taskdefinitionprops"></a>


Props for `KeycloakEc2TaskDefinition`.



Name | Type | Description 
-----|------|-------------
**cpu**? | <code>number</code> | The number of cpu units used by the task.<br/>__*Default*__: 256
**executionRole**? | <code>[IRole](#aws-cdk-aws-iam-irole)</code> | The name of the IAM task execution role that grants the ECS agent to call AWS APIs on your behalf.<br/>__*Default*__: An execution role will be automatically created if you use ECR images in your task definition.
**family**? | <code>string</code> | The name of a family that this task definition is registered to.<br/>__*Default*__: Automatically generated name.
**keycloak**? | <code>[KeycloakContainerExtensionProps](#wheatstalk-cdk-ecs-keycloak-keycloakcontainerextensionprops)</code> | Keycloak configuration.<br/>__*Optional*__
**memoryLimitMiB**? | <code>number</code> | The amount (in MiB) of memory used by the task.<br/>__*Default*__: 512
**proxyConfiguration**? | <code>[ProxyConfiguration](#aws-cdk-aws-ecs-proxyconfiguration)</code> | The configuration details for the App Mesh proxy.<br/>__*Default*__: No proxy configuration.
**taskRole**? | <code>[IRole](#aws-cdk-aws-iam-irole)</code> | The name of the IAM role that grants containers in the task permission to call AWS APIs on your behalf.<br/>__*Default*__: A task role is automatically created for you.
**volumes**? | <code>Array<[Volume](#aws-cdk-aws-ecs-volume)></code> | The list of volume definitions for the task.<br/>__*Default*__: No volumes are passed to the Docker daemon on a container instance.



## struct KeycloakFargateTaskDefinitionProps  <a id="wheatstalk-cdk-ecs-keycloak-keycloakfargatetaskdefinitionprops"></a>


Props for `KeycloakFargateTaskDefinition`.



Name | Type | Description 
-----|------|-------------
**cpu**? | <code>number</code> | The number of cpu units used by the task.<br/>__*Default*__: 256
**executionRole**? | <code>[IRole](#aws-cdk-aws-iam-irole)</code> | The name of the IAM task execution role that grants the ECS agent to call AWS APIs on your behalf.<br/>__*Default*__: An execution role will be automatically created if you use ECR images in your task definition.
**family**? | <code>string</code> | The name of a family that this task definition is registered to.<br/>__*Default*__: Automatically generated name.
**keycloak**? | <code>[KeycloakContainerExtensionProps](#wheatstalk-cdk-ecs-keycloak-keycloakcontainerextensionprops)</code> | Keycloak configuration.<br/>__*Optional*__
**memoryLimitMiB**? | <code>number</code> | The amount (in MiB) of memory used by the task.<br/>__*Default*__: 512
**proxyConfiguration**? | <code>[ProxyConfiguration](#aws-cdk-aws-ecs-proxyconfiguration)</code> | The configuration details for the App Mesh proxy.<br/>__*Default*__: No proxy configuration.
**taskRole**? | <code>[IRole](#aws-cdk-aws-iam-irole)</code> | The name of the IAM role that grants containers in the task permission to call AWS APIs on your behalf.<br/>__*Default*__: A task role is automatically created for you.
**volumes**? | <code>Array<[Volume](#aws-cdk-aws-ecs-volume)></code> | The list of volume definitions for the task.<br/>__*Default*__: No volumes are passed to the Docker daemon on a container instance.



## enum KeycloakDatabaseVendor  <a id="wheatstalk-cdk-ecs-keycloak-keycloakdatabasevendor"></a>



Name | Description
-----|-----
**H2** |H2 In-memory Database (Warning: data deleted when task restarts.).
**POSTGRES** |Postgres.
**MYSQL** |MySQL.
**MARIADB** |MariaDB.
**ORACLE** |Oracle database.
**MSSQL** |MSSQL.


