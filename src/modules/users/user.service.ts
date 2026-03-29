import { User } from './user.model';
import { IUser } from './user.interfaces';

const updateProfile = async (userId: string, updates: Partial<IUser>) => {
  const user = await User.findByIdAndUpdate(userId, updates, { new: true }).select('-password');
  return user;
};

const addAddress = async (userId: string, address: Partial<IUser['addresses'] extends (infer U)[] ? U : any>) => {
  const user = await User.findById(userId) as any;
  if (!user) return null;

  user.addresses = user.addresses || [];

  // If address requests to be default, unset other defaults first
  if ((address as any).isDefault) {
    if (Array.isArray(user.addresses)) {
      user.addresses.forEach((a: any) => {
        a.isDefault = false;
      });
    }
  }

  // If client provided an _id, update that address
  const addrId = (address as any)._id;
  if (addrId) {
    const existing = user.addresses.id ? user.addresses.id(addrId) : user.addresses.find((a: any) => String(a._id) === String(addrId));
    if (existing) {
      existing.label = (address as any).label || existing.label;
      existing.street = (address as any).street || existing.street;
      existing.city = (address as any).city || existing.city;
      existing.postalCode = (address as any).postalCode || existing.postalCode;
      existing.state = (address as any).state || existing.state;
      existing.phone = (address as any).phone || existing.phone;
      existing.fullName = (address as any).fullName || existing.fullName;
      if (typeof (address as any).isDefault !== 'undefined') existing.isDefault = !!(address as any).isDefault;
      await user.save();
      return User.findById(userId).select('-password');
    }
  }

  // If no _id provided, try to find by label and update that one (common UI behavior)
  if ((address as any).label) {
    const found = user.addresses.find((a: any) => a.label === (address as any).label);
    if (found) {
      found.street = (address as any).street || found.street;
      found.city = (address as any).city || found.city;
      found.postalCode = (address as any).postalCode || found.postalCode;
      found.state = (address as any).state || found.state;
      found.phone = (address as any).phone || found.phone;
      found.fullName = (address as any).fullName || found.fullName;
      if (typeof (address as any).isDefault !== 'undefined') found.isDefault = !!(address as any).isDefault;
      await user.save();
      return User.findById(userId).select('-password');
    }
  }

  // Otherwise push as a new address
  user.addresses.push({
    label: (address as any).label,
    street: (address as any).street,
    city: (address as any).city,
    postalCode: (address as any).postalCode,
    state: (address as any).state,
    phone: (address as any).phone,
    fullName: (address as any).fullName,
    isDefault: !!(address as any).isDefault,
    createdAt: new Date()
  } as any);

  await user.save();
  return User.findById(userId).select('-password');
};

const getAddresses = async (userId: string) => {
  const user = await User.findById(userId).select('-password');
  if (!user) return null;
  return user.addresses || [];
};

const updateAddressById = async (userId: string, addressId: string, payload: any) => {
  const user = await User.findById(userId) as any;
  if (!user) return null;
  user.addresses = user.addresses || [];

  const existing = user.addresses.id ? user.addresses.id(addressId) : user.addresses.find((a: any) => String(a._id) === String(addressId));
  if (!existing) return null;

  // if payload sets isDefault, unset others
  if (typeof payload.isDefault !== 'undefined' && payload.isDefault) {
    user.addresses.forEach((a: any) => { a.isDefault = false; });
  }

  existing.label = payload.label || existing.label;
  existing.street = payload.street || existing.street;
  existing.city = payload.city || existing.city;
  existing.postalCode = payload.postalCode || existing.postalCode;
  existing.state = payload.state || existing.state;
  existing.phone = payload.phone || existing.phone;
  existing.fullName = payload.fullName || existing.fullName;
  if (typeof payload.isDefault !== 'undefined') existing.isDefault = !!payload.isDefault;

  await user.save();
  return User.findById(userId).select('-password');
};

const deleteAddressById = async (userId: string, addressId: string) => {
  const user = await User.findById(userId) as any;
  if (!user) return null;
  user.addresses = user.addresses || [];

  // use mongoose subdoc id remove if available, otherwise fall back to filtering
  if (user.addresses.id) {
    const sub = user.addresses.id(addressId);
    if (sub) {
      if (typeof sub.remove === 'function') {
        sub.remove();
      } else {
        user.addresses = user.addresses.filter((a: any) => String(a._id) !== String(addressId));
      }
    }
  } else {
    user.addresses = user.addresses.filter((a: any) => String(a._id) !== String(addressId));
  }

  await user.save();
  return User.findById(userId).select('-password');
};

// Favorites
const addFavorite = async (userId: string, productId: string) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $addToSet: { favorites: productId } },
    { new: true }
  ).select('-password');
  return user;
};

const removeFavorite = async (userId: string, productId: string) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $pull: { favorites: productId } },
    { new: true }
  ).select('-password');
  return user;
};

const getFavorites = async (userId: string, page = 1, limit = 20) => {
  const user = await User.findById(userId).select('favorites');
  if (!user) return { products: [], meta: { total: 0, page, limit, totalPages: 0 } };

  const favs = (user as any).favorites || [];
  const total = favs.length;
  const skip = (page - 1) * limit;

  const Product = require('../products/product.model').Product;

  const products = await Product.find({ _id: { $in: favs }, isActive: true })
    .populate('category', 'name')
    .populate('shop', 'shopName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return {
    products,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
  };
};

// const addCard = async (userId: string, card: any) => {
//   const user = await User.findById(userId) as any;
//   if (!user) return null;

//   // if card marked default, unset others
//   if ((card as any).isDefault) {
//     if (Array.isArray(user.cards)) {
//       user.cards.forEach((c: any) => {
//         (c as any).isDefault = false;
//       });
//     }
//   }

//   user.cards = user.cards || [];

//   // sanitize/store only masked data and last4
//   const last4 = (card as any).last4 || (card as any).cardNumber ? String((card as any).cardNumber).slice(-4) : undefined;
//   const maskedNumber = last4 ? `**** **** **** ${last4}` : (card as any).maskedNumber;

//   user.cards.push({
//     brand: (card as any).brand,
//     last4: last4,
//     maskedNumber: maskedNumber,
//     expMonth: (card as any).expMonth,
//     expYear: (card as any).expYear,
//     name: (card as any).name,
//     isDefault: !!(card as any).isDefault,
//     createdAt: new Date()
//   } as any);

//   await user.save();
//   return User.findById(userId).select('-password');
// };

// const getCards = async (userId: string) => {
//   const user = await User.findById(userId).select('-password') as any;
//   if (!user) return null;
//   return user.cards || [];
// };

// const updateCardById = async (userId: string, cardId: string, payload: any) => {
//   const user = await User.findById(userId) as any;
//   if (!user) return null;
//   user.cards = user.cards || [];

//   const existing = user.cards.id ? user.cards.id(cardId) : user.cards.find((c: any) => String(c._id) === String(cardId));
//   if (!existing) return null;

//   // if payload sets isDefault, unset others
//   if (typeof payload.isDefault !== 'undefined' && payload.isDefault) {
//     user.cards.forEach((c: any) => { c.isDefault = false; });
//   }

//   existing.brand = payload.brand || existing.brand;
//   existing.last4 = payload.last4 || existing.last4;
//   existing.maskedNumber = payload.maskedNumber || existing.maskedNumber;
//   existing.expMonth = payload.expMonth || existing.expMonth;
//   existing.expYear = payload.expYear || existing.expYear;
//   existing.name = payload.name || existing.name;
//   if (typeof payload.isDefault !== 'undefined') existing.isDefault = !!payload.isDefault;

//   await user.save();
//   return User.findById(userId).select('-password');
// };

// const deleteCardById = async (userId: string, cardId: string) => {
//   const user = await User.findById(userId) as any;
//   if (!user) return null;
//   user.cards = user.cards || [];

//   if (user.cards.id) {
//     const sub = user.cards.id(cardId);
//     if (sub) sub.remove();
//   } else {
//     user.cards = user.cards.filter((c: any) => String(c._id) !== String(cardId));
//   }

//   await user.save();
//   return User.findById(userId).select('-password');
// };

export const UserService = {
  updateProfile,
  addAddress,

  getAddresses,
  updateAddressById,
  deleteAddressById,
  addFavorite,
  removeFavorite,
  getFavorites,
  // addCard,
  // getCards,
  // updateCardById,
  // deleteCardById
};
