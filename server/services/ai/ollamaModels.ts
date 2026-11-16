import { AiFailure } from './contracts';
const baseUrl = () => (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');

export async function listAiModels() {
  try {
    const res = await fetch(`${baseUrl()}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const models: { name: string; capabilities?: string[] }[] = await Promise.all(
      (Array.isArray(data.models) ? data.models : []).map(
        async (model: { name: string; capabilities?: string[] }) => {
          if (model.capabilities) return model;
          try {
            const details = await fetch(`${baseUrl()}/api/show`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: model.name }),
              signal: AbortSignal.timeout(5000),
            });
            if (!details.ok) return model;
            return {
              ...model,
              capabilities: (await details.json()).capabilities as string[] | undefined,
            };
          } catch {
            return model;
          }
        },
      ),
    );
    return {
      connected: true,
      models: models
        .filter((model) => !model.capabilities?.includes('embedding'))
        .map((model) => model.name) as string[],
      embeddingModels: models
        .filter((model) => model.capabilities?.includes('embedding'))
        .map((model) => model.name) as string[],
      error: null as string | null,
    };
  } catch {
    return {
      connected: false,
      models: [] as string[],
      embeddingModels: [] as string[],
      error: 'Không kết nối được Ollama. Kiểm tra dịch vụ và OLLAMA_URL trên backend.',
    };
  }
}
export async function requireInstalledEmbeddingModel(model: string) {
  const models = await listAiModels();
  if (!models.connected)
    throw new AiFailure(
      'EMBEDDING_UNAVAILABLE',
      'configuration',
      models.error || 'Không kết nối được Ollama.',
      503,
    );
  if (!models.embeddingModels.includes(model))
    throw new AiFailure(
      'INVALID_EMBEDDING_MODEL',
      'configuration',
      'Chọn model embedding đã được cài trên Ollama.',
      400,
    );
}
