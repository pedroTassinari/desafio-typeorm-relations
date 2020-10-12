import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('This customer does not exist');
    }

    const productsToFind = products.map(({ id }) => {
      return {
        id,
      };
    });

    const foundProducts = await this.productsRepository.findAllById(
      productsToFind,
    );

    if (foundProducts.length < products.length) {
      throw new AppError('Some ordered products do not exist');
    }

    const orderedProducts = foundProducts.map(foundProduct => {
      const orderedProduct = products.find(
        product => product.id === foundProduct.id,
      );

      if (!orderedProduct) {
        throw new AppError('Ordered product does not exist');
      }

      if (foundProduct.quantity < orderedProduct.quantity) {
        throw new AppError('You can not buy more products than what we have');
      }

      const data = {
        product_id: foundProduct.id,
        price: foundProduct.price,
        quantity: orderedProduct.quantity,
      };

      orderedProduct.quantity = foundProduct.quantity - orderedProduct.quantity;

      const indexToUpdateQuantity = products.indexOf(orderedProduct);
      products[indexToUpdateQuantity].quantity = orderedProduct.quantity;

      return data;
    });

    const order = await this.ordersRepository.create({
      customer,
      products: orderedProducts,
    });

    await this.productsRepository.updateQuantity(products);

    return order;
  }
}

export default CreateOrderService;
