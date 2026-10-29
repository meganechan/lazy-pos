import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
for (const dir of ['client', 'server']) {
  test(`${dir} has a complete lock matching its manifest`, () => {
    const manifest = JSON.parse(readFileSync(new URL(`${dir}/package.json`,root)));
    const lock = JSON.parse(readFileSync(new URL(`${dir}/package-lock.json`,root)));
    assert.equal(lock.lockfileVersion,3);
    assert.deepEqual(lock.packages[''].dependencies,manifest.dependencies);
    assert.deepEqual(lock.packages[''].devDependencies,manifest.devDependencies);
    for(const [name,pkg] of Object.entries(lock.packages)) {
      if(name) { assert.ok(pkg.version,name); assert.ok(pkg.integrity,name); }
    }
  });
}
test('both image stages install from the committed locks', () => {
  const dockerfile = readFileSync(new URL('Dockerfile',root),'utf8');
  assert.match(dockerfile,/COPY client\/package.json client\/package-lock.json/);
  assert.match(dockerfile,/COPY server\/package.json server\/package-lock.json/);
  assert.equal((dockerfile.match(/npm ci/g)||[]).length,2);
  assert.doesNotMatch(dockerfile,/npm install/);
});
