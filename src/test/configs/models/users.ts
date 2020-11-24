import { IEntityInfo } from "@funfunz/core/lib/generator/configurationTypes"

export const model: IEntityInfo = {
  name: 'funfunzUsers',
  connector: 'teamDynamoDB',
  visible: true,
  roles: {
    create: [
      'all'
    ],
    read: [
      'all'
    ],
    update: [
      'all'
    ],
    delete: [
      'all'
    ]
  },
  relations: [
    {
      type: '1:n',
      foreignKey: 'userId',
      remoteTable: 'funfunzUsersRoles'
    },
    {
      type: 'm:n',
      foreignKey: 'userId',
      relationalTable: 'funfunzUsersRoles',
      remoteTable: 'funfunzRoles',
      remoteForeignKey: 'roleId',
    }
  ],
  properties: [
    {
      name: 'userId',
      model: {
        type: 'text',
        allowNull: false,
        isPk: true,
      },
      layout: {
        label: 'Id',
      },
    },
    {
      name: 'name',
      model: {
        type: 'text',
        allowNull: true
      },
      layout: {
        label: 'Name',
      },
    },
    {
      name: 'createdAt',
      model: {
        type: 'text',
        allowNull: true,
      },
      layout: {
        label: 'Created at',
      },
    },
    {
      name: 'updatedAt',
      model: {
        type: 'text',
        allowNull: true,
      },
      layout: {
        label: 'Updated at',
      },
    },
  ],
  layout: {
    label: 'Users',
  }
}