export abstract class BaseService {
  protected handleError(error: any): never {
    console.error('Service Error:', error);
    throw error;
  }

  protected validateInput(input: any, schema?: any): boolean {
    return true;
  }
}