import React from 'react';
import Giscus from '@giscus/react';
import { useColorMode } from '@docusaurus/theme-common';

export default function GiscusComponent(): JSX.Element {
  const { colorMode } = useColorMode();

  return (
    <div style={{ marginTop: '3rem' }}>
      <Giscus
        repo="NakahodoRintaro/www.nakahodo.com"
        repoId="R_kgDORrWKPg"
        category="Announcements"
        categoryId="DIC_kwDORrWKPs4C44j7"
        mapping="pathname"
        strict="0"
        reactionsEnabled="1"
        emitMetadata="0"
        inputPosition="bottom"
        theme={colorMode === 'dark' ? 'dark_dimmed' : 'light'}
        lang="ja"
        loading="lazy"
      />
    </div>
  );
}
