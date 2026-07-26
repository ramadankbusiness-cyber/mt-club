import bcrypt from "bcryptjs";
import { supabase } from "../config/supabase.js";

export default class User {
  static async create({ name, email, password }) {
    const hash = await bcrypt.hash(password, 10);
    const { data } = await supabase
      .from("members")
      .insert({ name, email, password: hash, role: "member" })
      .select()
      .single();
    return { id: data.id, name, email, role: "member" };
  }

  static async findByEmail(email) {
    const { data } = await supabase.from("members").select("*").eq("email", email).single();
    return data;
  }
}
