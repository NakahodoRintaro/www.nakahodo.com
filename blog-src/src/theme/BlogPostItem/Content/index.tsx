import React from 'react';
import Content from '@theme-original/BlogPostItem/Content';
import type ContentType from '@theme/BlogPostItem/Content';
import type { WrapperProps } from '@docusaurus/types';
import { useBlogPost } from '@docusaurus/plugin-content-blog/client';
import GiscusComponent from '@site/src/components/GiscusComponent';

type Props = WrapperProps<typeof ContentType>;

export default function ContentWrapper(props: Props): JSX.Element {
  const { isBlogPostPage } = useBlogPost();

  return (
    <>
      <Content {...props} />
      {isBlogPostPage && <GiscusComponent />}
    </>
  );
}
