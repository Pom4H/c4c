/**
 * Simulated database module for users
 * This demonstrates how to organize business logic into separate modules
 */

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

// In-memory database
const users = new Map<string, User>();

export const userDatabase = {
  async create(data: { name: string; email: string; role: string }): Promise<User> {
    const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const user: User = {
      id,
      name: data.name,
      email: data.email,
      role: data.role,
      createdAt: new Date().toISOString(),
    };
    users.set(id, user);
    return user;
  },

  async findById(id: string): Promise<User | null> {
    return users.get(id) ?? null;
  },

  async findByEmail(email: string): Promise<User | null> {
    for (const user of users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  },

  async list(): Promise<User[]> {
    return Array.from(users.values());
  },

  async update(id: string, data: Partial<Omit<User, "id" | "createdAt">>): Promise<User | null> {
    const user = users.get(id);
    if (!user) return null;

    const updated = { ...user, ...data };
    users.set(id, updated);
    return updated;
  },

  async delete(id: string): Promise<boolean> {
    return users.delete(id);
  },

  async count(): Promise<number> {
    return users.size;
  },
};
