import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseRouteHash, formatRoute } from '../js/router.js';

describe('parseRouteHash', () => {
  test('empty hash -> gallery', () => {
    assert.deepEqual(parseRouteHash(''), { screen: 'gallery' });
  });

  test('undefined/null hash -> gallery', () => {
    assert.deepEqual(parseRouteHash(undefined), { screen: 'gallery' });
    assert.deepEqual(parseRouteHash(null), { screen: 'gallery' });
  });

  test('"#" alone -> gallery', () => {
    assert.deepEqual(parseRouteHash('#'), { screen: 'gallery' });
  });

  test('"#/" -> gallery', () => {
    assert.deepEqual(parseRouteHash('#/'), { screen: 'gallery' });
  });

  test('"#/new" -> newCanvas', () => {
    assert.deepEqual(parseRouteHash('#/new'), { screen: 'newCanvas' });
  });

  test('"#/project/<id>" -> workspace with projectId', () => {
    assert.deepEqual(parseRouteHash('#/project/abc-123'), {
      screen: 'workspace',
      projectId: 'abc-123',
    });
  });

  test('decodes URI-encoded project ids', () => {
    assert.deepEqual(parseRouteHash('#/project/abc%20123'), {
      screen: 'workspace',
      projectId: 'abc 123',
    });
  });

  test('"#/project/" (no id) -> gallery fallback', () => {
    assert.deepEqual(parseRouteHash('#/project/'), { screen: 'gallery' });
  });

  test('unrecognized path -> gallery fallback', () => {
    assert.deepEqual(parseRouteHash('#/unknown/route'), { screen: 'gallery' });
  });
});

describe('formatRoute', () => {
  test('gallery -> "#/"', () => {
    assert.equal(formatRoute({ screen: 'gallery' }), '#/');
  });

  test('undefined route -> "#/"', () => {
    assert.equal(formatRoute(undefined), '#/');
  });

  test('newCanvas -> "#/new"', () => {
    assert.equal(formatRoute({ screen: 'newCanvas' }), '#/new');
  });

  test('workspace with projectId -> "#/project/<id>"', () => {
    assert.equal(
      formatRoute({ screen: 'workspace', projectId: 'abc-123' }),
      '#/project/abc-123'
    );
  });

  test('encodes project ids that need it', () => {
    assert.equal(
      formatRoute({ screen: 'workspace', projectId: 'abc 123' }),
      '#/project/abc%20123'
    );
  });

  test('workspace without projectId falls back to gallery', () => {
    assert.equal(formatRoute({ screen: 'workspace' }), '#/');
  });

  test('roundtrips through parseRouteHash', () => {
    const routes = [
      { screen: 'gallery' },
      { screen: 'newCanvas' },
      { screen: 'workspace', projectId: 'some-uuid-here' },
    ];
    for (const route of routes) {
      assert.deepEqual(parseRouteHash(formatRoute(route)), route);
    }
  });
});
