import { css } from '@emotion/react';

export default ({ scrollbarSize: { scrollbarWidth } } = {}) => css`
  &.ReactTable .rt-thead.-header {
    padding-right: ${scrollbarWidth}px;
  }

  &.ReactTable {
    width: 100%;
    box-sizing: border-box;
    .rt-tbody {
      overflow-y: scroll;
      overflow-x: hidden;
    }
  }

  .-pageJump {
    border: solid 1px lightgrey;
    border-radius: 5px;
  }

  .ReactTable .-pagination_button {
    cursor: pointer;
    padding-left: 10px;
    padding-right: 10px;
    color: grey;
    user-select: none;
  }

  .ReactTable .-pagination_button.-current {
    background: lightgrey;
    color: #f0f1f6;
  }

  ul.list-values {
    margin: 0;
    padding-left: 1rem;

    > li {
      line-height: 1rem;
      margin-bottom: 0.3rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &.none {
      list-style: none;
      padding: 0;
    }

    &.commas {
      display: flex;
      flex-wrap: wrap;
      list-style: none;
      padding: 0;

      > li:not(:last-of-type)::after {
        content: ', ';
        margin-right: 0.2rem;
      }
    }

    &.letters {
      list-style: lower-alpha;
    }

    &.numbers {
      list-style: decimal;
    }

    &.roman {
      list-style: upper-roman;
    }
  }
`;
