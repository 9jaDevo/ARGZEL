import { deleteModel, model, models, type Model, type Schema } from 'mongoose';

/**
 * Registers a model, replacing any previous registration of the same name.
 * Mongoose keeps models in a process-wide registry, so after a dev hot reload
 * the old schema would otherwise stay in use and silently drop new fields.
 */
export function defineModel<T>(name: string, schema: Schema<T>, collection: string): Model<T> {
  if (models[name]) deleteModel(name);
  return model<T>(name, schema, collection);
}
