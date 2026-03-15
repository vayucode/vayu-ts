import type { CreateMeasurementRequest } from '../../openapi';
import { MeasurementsApi } from '../../openapi';
import { ConfigurationService } from '../services';
import type { PaginationOptions } from '../types';

export class MeasurementsClient {
  private client: MeasurementsApi;

  constructor() {
    this.client = ConfigurationService.instance.generateNewClient(MeasurementsApi);
  }

  async create(payload: CreateMeasurementRequest) {
    return this.client.createMeasurement(payload);
  }

  async delete(id: string) {
    return this.client.deleteMeasurement(id);
  }

  async get(id: string) {
    return this.client.getMeasurement(id);
  }

  async list(pagination?: PaginationOptions) {
    const cursor = pagination?.cursor;
    const limit = pagination?.limit;

    return this.client.listMeasurements(limit, cursor);
  }
}
