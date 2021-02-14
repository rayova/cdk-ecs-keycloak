import { expect as expectCDK, haveResourceLike } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import {
  HttpAlbPortPublisher, HttpListenerProvider,
  KeycloakCluster,
  ListenerProvider, NlbListenerProvider,
  NlbPortPublisher, NoneListenerProvider,
  NonePortPublisher,
  PortPublisher,
} from '../../src';

describe('keycloak cluster', () => {
  test('throws when listener providers and port publishin mixed', () => {
    const stack = new cdk.Stack();

    expect(() => new KeycloakCluster(stack, 'Cluster', {
      listenerProvider: ListenerProvider.http(),
      httpsPortPublisher: PortPublisher.httpAlb(),
    })).toThrow(/both/);
  });

  describe('deprecated listener provider', () => {
    test('publishes https publisher and not http publisher when https specified', () => {
      const stack = new cdk.Stack();
      const cluster = new KeycloakCluster(stack, 'Cluster', {
        // Internal SSL
        httpsListenerProvider: ListenerProvider.http(),
      });

      expect(cluster._httpPortPublisher instanceof NoneListenerProvider).toBeTruthy();
      expect(cluster._httpsPortPublisher instanceof HttpListenerProvider).toBeTruthy();
      expect(cluster._adminConsolePortPublisher instanceof NoneListenerProvider).toBeTruthy();
    });

    test('allows all ports to be published', () => {
      const stack = new cdk.Stack();
      const cluster = new KeycloakCluster(stack, 'Cluster', {
        // Internal SSL
        listenerProvider: ListenerProvider.nlb({ port: 8080 }),
        httpsListenerProvider: ListenerProvider.nlb({ port: 8443 }),
        adminConsoleListenerProvider: ListenerProvider.nlb({ port: 9700 }),
      });

      expect(cluster._httpPortPublisher instanceof NlbListenerProvider).toBeTruthy();
      expect(cluster._httpsPortPublisher instanceof NlbListenerProvider).toBeTruthy();
      expect(cluster._adminConsolePortPublisher instanceof NlbListenerProvider).toBeTruthy();
    });
  });

  describe('port publishing', () => {
    test('publishes http by load balancer by default', () => {
      const stack = new cdk.Stack();
      const cluster = new KeycloakCluster(stack, 'Cluster');

      expect(cluster._httpPortPublisher instanceof HttpAlbPortPublisher).toBeTruthy();
      expect(cluster._httpsPortPublisher instanceof NonePortPublisher).toBeTruthy();
      expect(cluster._adminConsolePortPublisher instanceof NonePortPublisher).toBeTruthy();

      expectCDK(stack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::LoadBalancer', {
        Type: 'application',
      }));
    });

    test('publishes https publisher and not http publisher when https specified', () => {
      const stack = new cdk.Stack();
      const cluster = new KeycloakCluster(stack, 'Cluster', {
        // Internal SSL
        httpsPortPublisher: PortPublisher.httpAlb(),
      });

      expect(cluster._httpPortPublisher instanceof NonePortPublisher).toBeTruthy();
      expect(cluster._httpsPortPublisher instanceof HttpAlbPortPublisher).toBeTruthy();
      expect(cluster._adminConsolePortPublisher instanceof NonePortPublisher).toBeTruthy();

      expectCDK(stack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::LoadBalancer', {
        Type: 'application',
      }));
    });

    test('allows all ports to be published', () => {
      const stack = new cdk.Stack();
      const cluster = new KeycloakCluster(stack, 'Cluster', {
        // Internal SSL
        httpPortPublisher: PortPublisher.nlb({ port: 8080 }),
        httpsPortPublisher: PortPublisher.nlb({ port: 8443 }),
        adminConsolePortPublisher: PortPublisher.nlb({ port: 9700 }),
      });

      expect(cluster._httpPortPublisher instanceof NlbPortPublisher).toBeTruthy();
      expect(cluster._httpsPortPublisher instanceof NlbPortPublisher).toBeTruthy();
      expect(cluster._adminConsolePortPublisher instanceof NlbPortPublisher).toBeTruthy();

      expectCDK(stack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::LoadBalancer', {
        Type: 'network',
      }));
    });
  });
});