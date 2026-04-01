import { IUser } from "../modules/users/user.interfaces";
import { User } from "../modules/users/user.model";
import bcryptjs from "bcryptjs";

export const seedSuperAdmin = async () => {
  try {
    const isSuperAdminExist = await User.findOne({
      email: process.env.SUPER_ADMIN_EMAIL,
    });

    if (isSuperAdminExist) {
      // console.log('Super Admin already exists');
      return;
    }

    const hashedPassword = await bcryptjs.hash(
      process.env.SUPER_ADMIN_PASSWORD as string,
      Number(process.env.BCRYPT_SALT_ROUND),
    );

    // const payload : IUser = {
    //     fullName : "Super Admin",
    //     role : "ADMIN",
    //     email : process.env.SUPER_ADMIN_EMAIL as string,
    //     password : hashedPassword,
    //     stripeConnectAccountId : "hadfkjhadfskjh"
    // }

    const superAdmin = await User.create({
      fullName: "Super Admin",
      role: "ADMIN",
      email: process.env.SUPER_ADMIN_EMAIL as string,
      password: hashedPassword,
    });
  } catch (err) {
    console.log(err);
  }
};
