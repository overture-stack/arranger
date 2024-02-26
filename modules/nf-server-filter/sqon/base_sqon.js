/**
 * Class to manage base SQONs
 */
export class BaseSQON {
  /**
   * Create base SQON
   */
  static generate() {
    return {
      op: 'and',
      content: [
        {
          op: 'or',
          content: [],
        },
      ],
    };
  }
}
