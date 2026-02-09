# Documents

```typescript
import { loadPaper } from './src/arxiv.ts';

// APIFY
const md = await loadPaper('https://arxiv.org/abs/2508.10925', 'gpt-oss-120b & gpt-oss-20b model card');

// Human
const md = await loadPaper('GPT-4 Technical Report');            // title
const md = await loadPaper('https://arxiv.org/abs/2303.08774');  // url
const md = await loadPaper('2303.08774');                        // id
```
