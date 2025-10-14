/**
 * Mock procedures for demo workflow execution
 * 
 * In a real application, these would be actual procedures registered in the framework
 */

/**
 * Mock procedure registry for demo
 */
export const mockProcedures: Record<
  string,
  (input: Record<string, unknown>) => Promise<Record<string, unknown>>
> = {
  "math.add": async (input: Record<string, unknown>) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const a = input.a as number;
    const b = input.b as number;
    return { result: a + b };
  },
  
  "math.multiply": async (input: Record<string, unknown>) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const a = input.a as number;
    const b = (input.b as number | undefined) ?? (input.result as number | undefined) ?? 1;
    return { result: a * b };
  },
  
  "math.subtract": async (input: Record<string, unknown>) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const a = input.a as number;
    const b = input.b as number;
    return { result: a - b };
  },
  
  "data.fetch": async (input: Record<string, unknown>) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    return {
      userId: input.userId as string,
      name: "John Doe",
      isPremium: true,
      data: { score: 95 },
    };
  },
  
  "data.process": async (input: Record<string, unknown>) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return {
      processedData: `${input.mode as string} processing completed`,
      score: 100,
    };
  },
  
  "data.save": async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { saved: true, timestamp: Date.now() };
  },
};
