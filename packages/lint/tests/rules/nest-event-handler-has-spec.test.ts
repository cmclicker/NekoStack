import { afterAll, describe, it } from 'vitest';
import { RuleTester } from '@typescript-eslint/rule-tester';
import {
  nestEventHandlerHasSpec,
  _setExistsSync,
} from '../../src/rules/nest-event-handler-has-spec.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe as typeof RuleTester.describe;
RuleTester.it = it as typeof RuleTester.it;

// event.handler has a spec; order.handler does not
_setExistsSync((p) => {
  const n = p.replace(/\\/g, '/');
  return (
    n.includes('/handlers/event.handler.spec.ts') ||
    n.includes('/handlers/event.handler.test.ts')
  );
});

const tester = new RuleTester();

tester.run('nest-event-handler-has-spec', nestEventHandlerHasSpec, {
  valid: [
    // @EventPattern method — spec file exists for this handler
    {
      code: [
        `class EventHandler {`,
        `  @EventPattern('user.created')`,
        `  handleUserCreated(payload: unknown) {}`,
        `}`,
      ].join('\n'),
      filename: '/app/handlers/event.handler.ts',
    },
    // @MessagePattern method — spec file exists
    {
      code: [
        `class EventHandler {`,
        `  @MessagePattern({ cmd: 'get_user' })`,
        `  getUser(data: unknown) {}`,
        `}`,
      ].join('\n'),
      filename: '/app/handlers/event.handler.ts',
    },
    // No event handler decorators — rule does not apply
    {
      code: [
        `class OrderService {`,
        `  async createOrder(data: unknown) {}`,
        `}`,
      ].join('\n'),
      filename: '/app/handlers/order.handler.ts',
    },
  ],
  invalid: [
    // @EventPattern method — no spec file for order.handler
    {
      code: [
        `class OrderHandler {`,
        `  @EventPattern('order.placed')`,
        `  handleOrderPlaced(payload: unknown) {}`,
        `}`,
      ].join('\n'),
      filename: '/app/handlers/order.handler.ts',
      errors: [
        {
          messageId: 'missingSpec',
          data: { method: 'handleOrderPlaced', decorator: 'EventPattern' },
        },
      ],
    },
    // @MessagePattern method — no spec file
    {
      code: [
        `class OrderHandler {`,
        `  @MessagePattern({ cmd: 'cancel_order' })`,
        `  cancelOrder(data: unknown) {}`,
        `}`,
      ].join('\n'),
      filename: '/app/handlers/order.handler.ts',
      errors: [
        {
          messageId: 'missingSpec',
          data: { method: 'cancelOrder', decorator: 'MessagePattern' },
        },
      ],
    },
    // Multiple decorated methods in same file missing spec — each reported
    {
      code: [
        `class PaymentHandler {`,
        `  @EventPattern('payment.initiated')`,
        `  onInitiated(payload: unknown) {}`,
        `  @MessagePattern({ cmd: 'refund' })`,
        `  refund(data: unknown) {}`,
        `}`,
      ].join('\n'),
      filename: '/app/handlers/payment.handler.ts',
      errors: [
        {
          messageId: 'missingSpec',
          data: { method: 'onInitiated', decorator: 'EventPattern' },
        },
        {
          messageId: 'missingSpec',
          data: { method: 'refund', decorator: 'MessagePattern' },
        },
      ],
    },
  ],
});
