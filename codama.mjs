import { createFromRoot } from 'codama';
import { rootNodeFromAnchor } from '@codama/nodes-from-anchor';
import { renderVisitor as renderJavaScriptVisitor } from '@codama/renderers-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const anchorIdl = JSON.parse(
  readFileSync(path.join(__dirname, 'target', 'idl', 'dutch_auction.json'), 'utf-8')
);

const codama = createFromRoot(rootNodeFromAnchor(anchorIdl));

const outputDir = path.join(__dirname, 'app', 'generated');
codama.accept(renderJavaScriptVisitor(outputDir));

console.log(`Generated Kit client in ${outputDir}`);
