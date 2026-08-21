declare module 'react-window' {
  import * as React from 'react';

  export interface ListChildComponentProps {
    index: number;
    style: React.CSSProperties;
    data?: unknown;
  }

  export interface FixedSizeListProps {
    height: number | string;
    width: number | string;
    itemCount: number;
    itemSize: number;
    itemData?: unknown;
    children: (props: ListChildComponentProps) => React.ReactElement | null;
  }

  export class FixedSizeList extends React.Component<FixedSizeListProps> {}
  export class VariableSizeList extends React.Component<any> {}
}
